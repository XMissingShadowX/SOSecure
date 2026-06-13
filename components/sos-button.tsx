/*
  SOSButton es el componente que maneja la funcionalidad principal de activación de la alerta SOS.
- Permite activar la alerta SOS manteniendo presionado el botón durante 1 segundo o un gesto secreto de 3 toques rápidos
- Al activarse, inicia la grabación de audio y video (si se conceden permisos), envía la ubicación actual a Supabase y 
  notifica a los contactos de emergencia
- Muestra una interfaz de grabación con opciones para cancelar, minimizar o finalizar la alerta
- Al finalizar, permite descargar la grabación localmente o guardarla en la nube vinculada a la alerta
- Si el usuario cancela la alerta, detiene la grabación, elimina la alerta de Supabase y restablece el estado
- NUEVO: También se puede activar presionando el botón de volumen (subir o bajar) 5 veces en 3 segundos
*/

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useVolumeSOS } from '@/hooks/use-volume-sos'
import { AlertTriangle, X, Bell, Mic, Video, StopCircle, Minimize2, ChevronUp, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { createLiveBroadcaster, type LiveBroadcaster } from '@/lib/live-stream'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const HOLD_DURATION = 1000
const SECRET_TAP_COUNT = 5
const SECRET_TAP_WINDOW = 3000

export function SOSButton() {
  const { sosActive, setSosActive, setSosAlert, setSosStream, contacts, setActiveTab, currentLocation: coordinates, volumePresses, volumeWindow, simpleMode } = useAppStore()
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [contactsNotified, setContactsNotified] = useState<string[]>([])
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [savedToCloud, setSavedToCloud]   = useState(false)
  const [downloadReady, setDownloadReady] = useState(false)
  const [isSaving, setIsSaving]           = useState(false)

  const recordingChunksRef = useRef<Blob[]>([])
  const recordingMimeRef   = useRef<string>('video/webm')
  const recordingStartRef  = useRef<number>(0)
  const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const segmentCountRef    = useRef<number>(0)

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const tapTimesRef = useRef<number[]>([])
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const liveBroadcasterRef = useRef<LiveBroadcaster | null>(null)

  // Sube los chunks acumulados hasta ahora como un segmento y dispara el evento para el chat.
  const uploadSegmentToChat = useCallback(async (alertId: string | null, isFinal = false) => {
    const chunks = recordingChunksRef.current
    if (!chunks.length) return
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const mime = recordingMimeRef.current
      const ext  = mime.includes('mp4') ? 'mp4' : 'webm'
      const segId = crypto.randomUUID()
      const blob  = new Blob([...chunks], { type: mime })
      const path  = `${user.id}/segments/${segId}.${ext}`
      const { error } = await supabase.storage
        .from('recordings')
        .upload(path, blob, { contentType: mime, upsert: false })
      if (error) return
      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(path)
      const segNum = ++segmentCountRef.current
      window.dispatchEvent(new CustomEvent('sosecure:recording-segment', {
        detail: {
          url: publicUrl,
          mimeType: mime,
          alertId,
          segmentNumber: segNum,
          isFinal,
        }
      }))
    } catch { /* sin conexión */ }
  }, [])

  // Detiene la transmisión de video en vivo (si está activa) sin afectar la grabación.
  const stopLive = useCallback(() => {
    if (liveBroadcasterRef.current) {
      try { liveBroadcasterRef.current.stop() } catch { /* noop */ }
      liveBroadcasterRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null }
  }, [])

  const activateSOS = useCallback(async () => {
    if (!coordinates) return
    const coords = coordinates

    setSosActive(true)
    setIsRecording(true)
    setMinimized(false)

    playAlarmSound()
    sendAlarmNotification('🚨 SOSecure SOS Activado', 'Alerta de emergencia enviada a tus contactos', true)

    let activeStream: MediaStream | null = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2,
        },
        video: {
          facingMode: { ideal: 'environment' },
          width:     { ideal: 1920, min: 1280 },
          height:    { ideal: 1080, min: 720  },
          frameRate: { ideal: 30,   min: 24   },
        }
      }).catch(
        () => navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
        })
      ).catch(
        () => navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      ).catch(
        () => navigator.mediaDevices.getUserMedia({ audio: true })
      )
      activeStream = stream
      setRecordingStream(stream)
      setSosStream(stream)

      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus'))
        ? 'video/webm;codecs=vp9,opus'
        : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus'))
        ? 'video/webm;codecs=vp8,opus'
        : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm'))
        ? 'video/webm'
        : 'video/mp4'

      recordingMimeRef.current   = mimeType
      recordingChunksRef.current = []
      recordingStartRef.current  = Date.now()

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        if (recordingChunksRef.current.length > 0) setDownloadReady(true)
      }
      recorder.start(500)
      setMediaRecorder(recorder)
    } catch { /* sin permisos */ }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: alert } = await supabase.from('sos_alerts').insert({
        user_id: user.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: 'active',
        contacts_notified: contacts.map(c => c.name),
      }).select().single()

      if (alert) {
        setSosAlert(alert)
        setActiveAlertId(alert.id)

        // ── Segmentos periódicos al chat (cada 60s) ───────────────────
        segmentCountRef.current = 0
        segmentIntervalRef.current = setInterval(() => {
          uploadSegmentToChat(alert.id, false)
        }, 60_000)

        // ── Transmisión de VIDEO EN VIVO ──────────────────────────────
        // Empezamos a enviar fotogramas en tiempo real al canal de la alerta
        // para que los contactos los vean al instante en /emergency/[alertId].
        // No afecta la grabación local ni la subida final.
        if (activeStream && activeStream.getVideoTracks().length) {
          const broadcaster = createLiveBroadcaster(alert.id)
          liveBroadcasterRef.current = broadcaster
          broadcaster.start(activeStream).catch(() => { /* sin conexión Realtime */ })
        }

        await supabase.from('sos_locations').insert({
          alert_id: alert.id,
          user_id: user.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
        })

        const { data: contactsWithEmail } = await supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', user.id)

        if (contactsWithEmail?.some((c: any) => c.email)) {
          await fetch('https://mtpbgfumbqfiiqgyjcey.supabase.co/functions/v1/notify-contacts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              alert_id: alert.id,
              user_id: user.id,
              user_name: user.user_metadata?.full_name || user.email,
              latitude: coords.latitude,
              longitude: coords.longitude,
              contacts: contactsWithEmail,
            }),
          })
        }
      }

      setContactsNotified(contacts.map(c => c.name))

      await supabase.from('incidents').insert({
        user_id: user.id,
        title: 'Alerta SOS',
        description: 'SOS de emergencia activado',
        incident_type: 'SOS',
        severity: 'high',
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
    }
  }, [coordinates, contacts, setSosActive, setSosAlert])

  useEffect(() => {
    if (recordingStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = recordingStream
      videoPreviewRef.current.play().catch(() => {})
    }
  }, [recordingStream])

  useEffect(() => {
    if (!sosActive || !coordinates || !activeAlertId) return
    const supabase = createClient()

    const updateLocation = async () => {
      if (!coordinates || !activeAlertId) return
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('sos_locations')
          .update({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('alert_id', activeAlertId)
          .eq('user_id', user.id)
      }
    }

    updateLocation()
    const interval = setInterval(updateLocation, 1000)
    return () => clearInterval(interval)
  }, [sosActive, coordinates, activeAlertId])

  const handleSecretTap = useCallback(() => {
    const now = Date.now()
    tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < SECRET_TAP_WINDOW), now]
    if (tapTimesRef.current.length >= SECRET_TAP_COUNT) {
      tapTimesRef.current = []
      activateSOS()
    }
  }, [activateSOS])

  useEffect(() => {
    const handler = () => { if (!sosActive) activateSOS() }
    window.addEventListener('sosecure:activate', handler)
    return () => window.removeEventListener('sosecure:activate', handler)
  }, [sosActive, activateSOS])


  const handleHoldStart = useCallback(() => {
    if (sosActive) return
    setIsHolding(true)
    setHoldProgress(0)
    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setHoldProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100))
    }, 50)
    holdTimerRef.current = setTimeout(() => {
      clearTimers()
      setIsHolding(false)
      setHoldProgress(0)
      activateSOS()
    }, HOLD_DURATION)
  }, [sosActive, clearTimers, activateSOS])

  const handleHoldEnd = useCallback(() => {
    clearTimers()
    setIsHolding(false)
    setHoldProgress(0)
  }, [clearTimers])

  const downloadRecording = () => {
    const chunks = recordingChunksRef.current
    if (!chunks.length) return
    const mime     = recordingMimeRef.current
    const ext      = mime.includes('mp4') ? 'mp4' : 'webm'
    const dt       = new Date()
    const datePart = dt.toLocaleDateString('sv-SE')
    const timePart = dt.toLocaleTimeString('sv-SE').replace(/:/g, '-')
    const filename = `safewalk-sos-${datePart}_${timePart}.${ext}`
    const blob     = new Blob(chunks, { type: mime })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href = url; a.download = filename; a.style.display = 'none'
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 2000)
  }

  const saveRecordingToCloud = async (alertId: string) => {
    const chunks = recordingChunksRef.current
    if (!chunks.length) return
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const mime  = recordingMimeRef.current
      const ext   = mime.includes('mp4') ? 'mp4' : 'webm'
      const recId = crypto.randomUUID()
      const blob  = new Blob(chunks, { type: mime })
      const path  = `${user.id}/${recId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('recordings')
        .upload(path, blob, { contentType: mime, upsert: false })
      if (upErr) { console.error('Upload error:', upErr.message); return }
      await supabase.from('recordings').insert({
        id: recId, user_id: user.id, storage_path: path,
        recording_type: 'video', mime_type: mime,
        duration_ms: Date.now() - recordingStartRef.current,
        file_size_bytes: blob.size,
        latitude:  coordinates?.latitude  ?? null,
        longitude: coordinates?.longitude ?? null,
        sos_alert_id: alertId,
      })
      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(path)
      await supabase.from('sos_alerts').update({ video_url: publicUrl }).eq('id', alertId)
      setSavedToCloud(true)
    } catch (err) { console.error('saveRecordingToCloud failed:', err) }
  }

  const handleSaveAndClose = useCallback(() => {
    setIsSaving(true)

    const finalize = async () => {
      stopLive()
      if (recordingStream) recordingStream.getTracks().forEach(t => t.stop())
      setRecordingStream(null)
      setSosStream(null)
      setIsRecording(false)
      if (recordingChunksRef.current.length > 0) {
        setDownloadReady(true)
        downloadRecording()
      }
      if (segmentIntervalRef.current) { clearInterval(segmentIntervalRef.current); segmentIntervalRef.current = null }
      if (activeAlertId) {
        await saveRecordingToCloud(activeAlertId)
        await uploadSegmentToChat(activeAlertId, true)
      }
      setIsSaving(false)
      setMinimized(true)
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => { finalize() }
      mediaRecorder.stop()
    } else {
      finalize()
    }
  }, [mediaRecorder, recordingStream, activeAlertId])

  const cancelSOS = useCallback(async () => {
    if (segmentIntervalRef.current) { clearInterval(segmentIntervalRef.current); segmentIntervalRef.current = null }
    stopLive()
    if (mediaRecorder) { try { mediaRecorder.stop() } catch { /* ignore */ } }
    if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()) }
    setMediaRecorder(null)
    setRecordingStream(null)
    setSosStream(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('sos_alerts').delete().eq('user_id', user.id).eq('status', 'active')
      await supabase.from('incidents').delete().eq('user_id', user.id).eq('title', 'Alerta SOS').gte('reported_at', new Date(Date.now() - 60000).toISOString())
    }

    setSosActive(false)
    setSosAlert(null)
    setIsRecording(false)
    setContactsNotified([])
    setShowCancelDialog(false)
    setMinimized(false)
    setActiveAlertId(null)
    setSavedToCloud(false)
    setDownloadReady(false)
    recordingChunksRef.current = []
  }, [setSosActive, setSosAlert, mediaRecorder, recordingStream])

  useEffect(() => () => {
    clearTimers()
    stopLive()
    if (segmentIntervalRef.current) clearInterval(segmentIntervalRef.current)
  }, [clearTimers, stopLive])

  // ── Activación por botones de volumen ──────────────────────────────────
  // 5 pulsaciones (subir o bajar) en menos de 3 segundos activan el SOS.
  useVolumeSOS({
    onActivate: activateSOS,
    disabled: sosActive,
    pressesRequired: volumePresses,
    timeWindowMs: volumeWindow,
  })

  if (sosActive) {
    return (
      <>
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          className="fixed -top-[9999px] -left-[9999px] w-px h-px"
        />

        {!minimized && (
          <div className="fixed inset-0 z-[200] bg-destructive/10 backdrop-blur-sm overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-8">
              <div className="w-full max-w-sm space-y-4">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                    <span className="font-semibold">SOS ACTIVO</span>
                  </div>
                  <button
                    onClick={() => setMinimized(true)}
                    className="opacity-0 pointer-events-none flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-destructive">
                  {recordingStream ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && recordingStream) {
                          el.srcObject = recordingStream
                          el.play().catch(() => {})
                        }
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Video className="w-12 h-12 text-muted-foreground animate-pulse" />
                      <p className="text-xs text-muted-foreground">Iniciando cámara...</p>
                    </div>
                  )}
                  {recordingStream && !recordingStream.getVideoTracks().length && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card">
                      <Mic className="w-10 h-10 text-destructive animate-pulse" />
                      <p className="text-xs text-muted-foreground">Solo audio activo</p>
                    </div>
                  )}
                  {isRecording && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 bg-destructive rounded text-xs text-destructive-foreground font-medium">
                      <div className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
                      REC
                    </div>
                  )}
                </div>

                {coordinates && (
                  <div className="p-3 bg-card rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">Tu ubicación</p>
                    <p className="font-mono text-sm text-foreground">
                      {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {contactsNotified.length > 0 && (
                  <div className="p-3 bg-card rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" />
                      Contactos notificados
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {contactsNotified.map((name) => (
                        <span key={name} className="px-2 py-0.5 bg-destructive/20 text-destructive rounded-full text-xs font-medium">{name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setMinimized(true); setActiveTab('before') }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary font-medium text-sm hover:bg-primary/90 transition-colors !text-black dark:!text-white"
                >
                  Ver en Mapa
                </button>

                <button
                  onClick={handleSaveAndClose}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-card border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {savedToCloud ? '✅ Guardado — cerrar alerta' : 'Guardar y cerrar alerta'}
                    </>
                  )}
                </button>

                {recordingStream ? (
                  <button
                    onClick={() => {
                      stopLive()
                      if (mediaRecorder) { try { mediaRecorder.stop() } catch { /**/ } }
                      recordingStream.getTracks().forEach(t => t.stop())
                      setRecordingStream(null)
                      setSosStream(null)
                      setIsRecording(false)
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm hover:bg-muted transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    Detener grabación
                  </button>
                ) : !isRecording && (
                  <button
                    onClick={async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                          audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            sampleRate: 48000,
                            channelCount: 2,
                          },
                          video: {
                            facingMode: { ideal: 'environment' },
                            width:     { ideal: 1920, min: 1280 },
                            height:    { ideal: 1080, min: 720  },
                            frameRate: { ideal: 30,   min: 24   },
                          }
                        }).catch(
                          () => navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                        ).catch(
                          () => navigator.mediaDevices.getUserMedia({ audio: true })
                        )
                        setRecordingStream(stream)
                        const rMime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus'))
                          ? 'video/webm;codecs=vp9,opus'
                          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                          ? 'video/webm;codecs=vp8,opus'
                          : 'video/webm'
                        const recorder = new MediaRecorder(stream, { mimeType: rMime, videoBitsPerSecond: 4_000_000 })
                        recorder.start(500)
                        setMediaRecorder(recorder)
                        setIsRecording(true)
                        // Reanudar también la transmisión en vivo para los contactos.
                        if (activeAlertId && stream.getVideoTracks().length) {
                          stopLive()
                          const broadcaster = createLiveBroadcaster(activeAlertId)
                          liveBroadcasterRef.current = broadcaster
                          broadcaster.start(stream).catch(() => { /* sin Realtime */ })
                        }
                      } catch { /* sin permisos */ }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm hover:bg-muted transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    Reanudar grabación
                  </button>
                )}

                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-destructive text-destructive font-medium text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                  Falsa alarma
                </button>

              </div>
            </div>
          </div>
        )}

        {minimized && (
          <button
            onClick={() => setMinimized(false)}
            className="fixed bottom-24 right-4 z-[200] flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/40 animate-pulse"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-destructive-foreground animate-ping" />
            <ChevronUp className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wide">SOS ACTIVO</span>
          </button>
        )}

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent className="z-[300]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Marcar como falsa alarma?</AlertDialogTitle>
              <AlertDialogDescription>
                Esto eliminará la alerta del sistema. Tus contactos ya han sido notificados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Mantener activo</AlertDialogCancel>
              <AlertDialogAction onClick={cancelSOS} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, es falsa alarma
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-50 safe-area-bottom flex flex-col items-center gap-2 ${simpleMode ? 'bottom-24' : 'bottom-20'}`}>
      <div
        className={`absolute -top-8 opacity-0 cursor-pointer ${simpleMode ? 'w-28 h-8' : 'w-20 h-8'}`}
        onClick={handleSecretTap}
        aria-label="Activación alternativa SOS"
      />

      <button
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        className={cn(
          `relative rounded-full bg-destructive text-destructive-foreground`,
          simpleMode ? "w-28 h-28" : "w-20 h-20",
          "flex items-center justify-center",
          "shadow-lg shadow-destructive/30",
          "transition-transform active:scale-95",
          isHolding && "sos-pulse"
        )}
        aria-label="Mantén presionado 2 segundos para activar SOS"
      >
        {isHolding && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx={simpleMode ? 56 : 40}
              cy={simpleMode ? 56 : 40}
              r={simpleMode ? 50 : 36}
              fill="none" stroke="currentColor" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * (simpleMode ? 50 : 36)}`}
              strokeDashoffset={`${2 * Math.PI * (simpleMode ? 50 : 36) * (1 - holdProgress / 100)}`}
              className="opacity-50"
            />
          </svg>
        )}
        <div className="flex flex-col items-center">
          <AlertTriangle className={simpleMode ? "w-12 h-12" : "w-8 h-8"} />
          <span className={`font-bold mt-0.5 ${simpleMode ? 'text-base' : 'text-xs'}`}>SOS</span>
        </div>
      </button>

      <p
        className={`whitespace-nowrap font-medium px-3 py-1 rounded-full -mt-1 ${simpleMode ? 'text-base' : 'text-sm'}`}
        style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)', color: '#991b1b' }}
      >
        {isHolding ? 'Mantén presionado...' : 'Presiona'}
      </p>
    </div>
  )
}