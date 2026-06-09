/*
  * lib/live-stream.ts — Transmisión de VIDEO EN VIVO para SOSecure.
  *
  * Cuando se activa una alerta SOS, este módulo captura fotogramas de la cámara
  * (la misma MediaStream que ya se está grabando) y los envía en tiempo real a
  * través de un canal de Supabase Realtime (broadcast). Los contactos de emergencia,
  * al abrir la página pública /emergency/[alertId], se suscriben al mismo canal y
  * reciben los fotogramas al instante, viendo lo que ocurre EN VIVO.
  *
  * Diseño:
  *  - No requiere WebRTC ni servidores TURN/STUN (funciona con export estático + Capacitor).
  *  - No requiere migraciones nuevas: el broadcast es efímero (en memoria de Supabase Realtime).
  *  - No interfiere con la grabación local ni con la subida final a Storage; solo AÑADE
  *    una capa en vivo encima del flujo existente.
  *  - Fotogramas JPEG comprimidos y reescalados para mantener cada mensaje muy por debajo
  *    del límite de payload de Realtime (~256 KB).
*/

import { createClient } from '@/lib/supabase/client'

// Nombre del canal de Realtime asociado a una alerta concreta.
// El emisor (víctima) y los receptores (contactos) deben usar exactamente el mismo nombre.
export function liveChannelName(alertId: string): string {
  return `live-sos-${alertId}`
}

// Estructura del payload que viaja por el broadcast en cada fotograma.
export interface LiveFramePayload {
  img: string   // data URL JPEG (base64)
  ts: number    // timestamp en ms (Date.now())
}

// Estructura del payload de estado (inicio/fin de la transmisión).
export interface LiveStatusPayload {
  live: boolean
  ts: number
}

// Parámetros de calidad/rendimiento de la transmisión en vivo.
const FRAME_INTERVAL_MS = 800   // ~1.25 fotogramas por segundo
const MAX_WIDTH = 480           // ancho máximo del fotograma (px)
const DEFAULT_QUALITY = 0.5     // calidad JPEG inicial (0–1)
const MAX_PAYLOAD_CHARS = 200_000 // si el data URL supera esto, bajamos calidad

// Controlador devuelto por createLiveBroadcaster, con métodos para iniciar y detener.
export interface LiveBroadcaster {
  start: (stream: MediaStream) => Promise<void>
  stop: () => void
  isActive: () => boolean
}

/*
  Crea un emisor de video en vivo para una alerta.
  Uso típico desde el SOSButton:
    const live = createLiveBroadcaster(alert.id)
    await live.start(stream)   // stream = la misma cámara que se está grabando
    ...
    live.stop()                // al cerrar/cancelar la alerta
*/
export function createLiveBroadcaster(alertId: string): LiveBroadcaster {
  const supabase = createClient()
  const channel = supabase.channel(liveChannelName(alertId), {
    config: { broadcast: { ack: false, self: false } },
  })

  let intervalId: ReturnType<typeof setInterval> | null = null
  let videoEl: HTMLVideoElement | null = null
  let canvasEl: HTMLCanvasElement | null = null
  let quality = DEFAULT_QUALITY
  let subscribed = false
  let active = false

  // Captura un fotograma del <video> oculto y lo envía por el canal.
  const sendFrame = () => {
    if (!subscribed || !videoEl || !canvasEl) return
    const vw = videoEl.videoWidth
    const vh = videoEl.videoHeight
    if (!vw || !vh) return // la cámara aún no entrega imagen

    const scale = Math.min(1, MAX_WIDTH / vw)
    const w = Math.round(vw * scale)
    const h = Math.round(vh * scale)
    if (canvasEl.width !== w) canvasEl.width = w
    if (canvasEl.height !== h) canvasEl.height = h

    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoEl, 0, 0, w, h)

    let img: string
    try {
      img = canvasEl.toDataURL('image/jpeg', quality)
    } catch {
      return
    }

    // Control de tamaño: si un fotograma sale muy pesado, bajamos calidad para los siguientes.
    if (img.length > MAX_PAYLOAD_CHARS && quality > 0.3) {
      quality = Math.max(0.3, quality - 0.1)
      return // saltamos este fotograma; el siguiente irá más comprimido
    }

    const payload: LiveFramePayload = { img, ts: Date.now() }
    channel.send({ type: 'broadcast', event: 'frame', payload })
  }

  const start = async (stream: MediaStream) => {
    // Solo tiene sentido transmitir si hay pista de video (no audio puro).
    if (!stream.getVideoTracks().length) return
    if (active) return
    active = true

    // <video> oculto que reproduce la cámara para poder dibujarlo en el canvas.
    videoEl = document.createElement('video')
    videoEl.muted = true
    videoEl.playsInline = true
    videoEl.setAttribute('playsinline', 'true')
    videoEl.srcObject = stream
    canvasEl = document.createElement('canvas')

    try {
      await videoEl.play()
    } catch {
      /* algunos navegadores tardan; el intervalo reintenta igual */
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && !intervalId) {
        subscribed = true
        // Avisamos que comienza la transmisión en vivo.
        const statusPayload: LiveStatusPayload = { live: true, ts: Date.now() }
        channel.send({ type: 'broadcast', event: 'status', payload: statusPayload })
        // Enviamos fotogramas de forma periódica.
        intervalId = setInterval(sendFrame, FRAME_INTERVAL_MS)
      }
    })
  }

  const stop = () => {
    if (!active && !subscribed) {
      try { supabase.removeChannel(channel) } catch { /* noop */ }
      return
    }
    active = false
    if (intervalId) { clearInterval(intervalId); intervalId = null }

    // Avisamos a los contactos que la transmisión terminó.
    if (subscribed) {
      const statusPayload: LiveStatusPayload = { live: false, ts: Date.now() }
      try { channel.send({ type: 'broadcast', event: 'status', payload: statusPayload }) } catch { /* noop */ }
    }
    subscribed = false

    if (videoEl) {
      try { videoEl.pause() } catch { /* noop */ }
      videoEl.srcObject = null
      videoEl = null
    }
    canvasEl = null

    try { supabase.removeChannel(channel) } catch { /* noop */ }
  }

  const isActive = () => active

  return { start, stop, isActive }
}
