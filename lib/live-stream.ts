/*
  lib/live-stream.ts — Transmisión de VIDEO EN VIVO para SOSecure.

  Estrategia de máxima fluidez:
  - MediaRecorder con chunks de 250 ms → latencia ≤ 1 s extremo a extremo.
  - Conversión Blob→base64 con Blob.arrayBuffer() (sin callbacks FileReader).
  - El receptor hace "live-edge seeking": si el video se atrasa > 0.5 s del
    borde del buffer, salta inmediatamente al frente para mantenerse en vivo.
  - Fallback JPEG automático para navegadores sin MediaRecorder.
*/

import { createClient } from '@/lib/supabase/client'

export function liveChannelName(alertId: string): string {
  return `live-sos-${alertId}`
}

// ── Tipos de payload ──────────────────────────────────────────────────────────

export interface LiveStatusPayload {
  live: boolean
  ts: number
  mode: 'video' | 'jpeg'
  mimeType?: string
}

export interface VideoChunkPayload {
  chunk: string      // base64
  ts: number
  seq: number        // 0 = primer chunk (contiene cabecera de inicialización WebM)
  mimeType?: string  // presente en seq=0 para que el receptor pueda inicializar sin esperar status
}

export interface LiveFramePayload {
  img: string   // data URL JPEG (fallback)
  ts: number
}

// ── Parámetros de rendimiento ─────────────────────────────────────────────────

const CHUNK_INTERVAL_MS = 200       // 5 chunks/s → latencia ~0.3-0.8 s
const VIDEO_BITRATE     = 1_500_000 // 1.5 Mbps — 720p fluido
const MAX_CHUNK_B64     = 220_000   // ~165 KB binario; límite Supabase ~256 KB
const FRAME_INTERVAL_MS = 150       // JPEG fallback: ~7 fps
const MAX_WIDTH         = 720       // 720p
const JPEG_QUALITY      = 0.75      // mayor calidad JPEG

// VP8 primero: mejor soporte en móviles; VP9 mayor compresión en desktop.
const PREFERRED_MIME = [
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp9',
  'video/webm',
]

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LiveBroadcaster {
  start: (stream: MediaStream) => Promise<void>
  stop: () => void
  isActive: () => boolean
}

// ── Broadcaster ───────────────────────────────────────────────────────────────

export function createLiveBroadcaster(alertId: string): LiveBroadcaster {
  const supabase = createClient()
  const channel = supabase.channel(liveChannelName(alertId), {
    config: { broadcast: { ack: false, self: false } },
  })

  let active     = false
  let subscribed = false
  let recorder: MediaRecorder | null = null
  let seq = 0

  // Fallback JPEG
  let intervalId: ReturnType<typeof setInterval> | null = null
  let videoEl: HTMLVideoElement | null = null
  let canvasEl: HTMLCanvasElement | null = null
  let jpegQuality = JPEG_QUALITY

  // Convierte Blob a base64 usando Blob.arrayBuffer() — más rápido que FileReader.
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const buf = await blob.arrayBuffer()
    const arr = new Uint8Array(buf)
    let b64 = ''
    // Procesar en bloques de 8192 bytes para evitar stack overflow en btoa.
    const BLOCK = 8192
    for (let i = 0; i < arr.length; i += BLOCK) {
      b64 += String.fromCharCode(...arr.subarray(i, i + BLOCK))
    }
    return btoa(b64)
  }

  const sendJpegFrame = () => {
    if (!subscribed || !videoEl || !canvasEl) return
    const vw = videoEl.videoWidth
    const vh = videoEl.videoHeight
    if (!vw || !vh) return
    const scale = Math.min(1, MAX_WIDTH / vw)
    const w = Math.round(vw * scale)
    const h = Math.round(vh * scale)
    if (canvasEl.width !== w) canvasEl.width = w
    if (canvasEl.height !== h) canvasEl.height = h
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoEl, 0, 0, w, h)
    let img: string
    try { img = canvasEl.toDataURL('image/jpeg', jpegQuality) } catch { return }
    if (img.length > 200_000 && jpegQuality > 0.3) {
      jpegQuality = Math.max(0.3, jpegQuality - 0.1)
      return
    }
    channel.send({ type: 'broadcast', event: 'frame', payload: { img, ts: Date.now() } satisfies LiveFramePayload })
  }

  const startJpegFallback = (stream: MediaStream) => {
    videoEl = document.createElement('video')
    videoEl.muted = true
    videoEl.playsInline = true
    videoEl.setAttribute('playsinline', 'true')
    videoEl.srcObject = stream
    canvasEl = document.createElement('canvas')
    videoEl.play().catch(() => {})
    intervalId = setInterval(sendJpegFrame, FRAME_INTERVAL_MS)
  }

  const start = async (stream: MediaStream) => {
    if (!stream.getVideoTracks().length || active) return
    active = true

    const mimeType = PREFERRED_MIME.find(m => {
      try { return MediaRecorder.isTypeSupported(m) } catch { return false }
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || subscribed) return
      subscribed = true

      const mode: 'video' | 'jpeg' = mimeType ? 'video' : 'jpeg'
      channel.send({
        type: 'broadcast',
        event: 'status',
        payload: { live: true, ts: Date.now(), mode, mimeType } satisfies LiveStatusPayload,
      })

      if (mimeType) {
        try {
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: VIDEO_BITRATE,
          })
          recorder.ondataavailable = async (e) => {
            if (!e.data || e.data.size === 0) return
            try {
              const b64 = await blobToBase64(e.data)
              if (b64.length > MAX_CHUNK_B64) return
              const currentSeq = seq++
              const payload: VideoChunkPayload = {
                chunk: b64,
                ts: Date.now(),
                seq: currentSeq,
                // Incluir mimeType en el primer chunk para que el receptor
                // pueda inicializar MediaSource aunque status llegue tarde.
                ...(currentSeq === 0 ? { mimeType } : {}),
              }
              channel.send({ type: 'broadcast', event: 'video_chunk', payload })
            } catch { /* noop */ }
          }
          recorder.start(CHUNK_INTERVAL_MS)
        } catch {
          startJpegFallback(stream)
        }
      } else {
        startJpegFallback(stream)
      }
    })
  }

  const stop = () => {
    if (!active && !subscribed) { try { supabase.removeChannel(channel) } catch { /* noop */ }; return }
    active = false
    if (recorder) { try { recorder.stop() } catch { /* noop */ }; recorder = null }
    if (intervalId) { clearInterval(intervalId); intervalId = null }
    if (videoEl) { try { videoEl.pause() } catch { /* noop */ }; videoEl.srcObject = null; videoEl = null }
    canvasEl = null
    if (subscribed) {
      try { channel.send({ type: 'broadcast', event: 'status', payload: { live: false, ts: Date.now(), mode: 'jpeg' } satisfies LiveStatusPayload }) } catch { /* noop */ }
    }
    subscribed = false
    try { supabase.removeChannel(channel) } catch { /* noop */ }
  }

  return { start, stop, isActive: () => active }
}
