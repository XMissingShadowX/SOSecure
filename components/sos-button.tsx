'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, X, Bell, Mic, Video, StopCircle, Minimize2, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
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

const HOLD_DURATION = 2000
const SECRET_TAP_COUNT = 5
const SECRET_TAP_WINDOW = 3000

export function SOSButton() {
  const { sosActive, setSosActive, setSosAlert, contacts, setActiveTab } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [contactsNotified, setContactsNotified] = useState<string[]>([])
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [minimized, setMinimized] = useState(false)

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const tapTimesRef = useRef<number[]>([])
  const voiceListeningRef = useRef(false)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null }
  }, [])

  const activateSOS = useCallback(async () => {
    if (!coordinates) return

    setSosActive(true)
    setIsRecording(true)
    setMinimized(false)

    playAlarmSound()
    sendAlarmNotification('🚨 SOSecure SOS Activado', 'Alerta de emergencia enviada a tus contactos', true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(
        () => navigator.mediaDevices.getUserMedia({ audio: true })
      )
      setRecordingStream(stream)
      const recorder = new MediaRecorder(stream)
      recorder.start()
      setMediaRecorder(recorder)
    } catch {
      // Recording not available
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: alert } = await supabase.from('sos_alerts').insert({
        user_id: user.id,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        status: 'active',
        contacts_notified: contacts.map(c => c.name),
      }).select().single()

      if (alert) setSosAlert(alert)

      await supabase.from('incidents').insert({
        user_id: user.id,
        title: 'Alerta SOS',
        description: 'SOS de emergencia activado',
        incident_type: 'other',
        severity: 'high',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
    }

    setContactsNotified(contacts.map(c => c.name))
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
  }, [coordinates, contacts, setSosActive, setSosAlert])

  // Conectar stream al <video> oculto para mantenerlo vivo al minimizar
  useEffect(() => {
    if (recordingStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = recordingStream
      videoPreviewRef.current.play().catch(() => {})
    }
  }, [recordingStream])

  // Secret tap sequence
  const handleSecretTap = useCallback(() => {
    const now = Date.now()
    tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < SECRET_TAP_WINDOW), now]
    if (tapTimesRef.current.length >= SECRET_TAP_COUNT) {
      tapTimesRef.current = []
      activateSOS()
    }
  }, [activateSOS])

  // Escucha activaciones externas (durante-tab)
  useEffect(() => {
    const handler = () => { if (!sosActive) activateSOS() }
    window.addEventListener('sosecure:activate', handler)
    return () => window.removeEventListener('sosecure:activate', handler)
  }, [sosActive, activateSOS])

  // Voice activation
  useEffect(() => {
    if (sosActive || voiceListeningRef.current) return
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.lang = 'es-MX'

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase()
      if (transcript.includes('auxilio') || transcript.includes('ayuda') || transcript.includes('sos') || transcript.includes('emergencia')) {
        activateSOS()
      }
    }

    try {
      recognition.start()
      voiceListeningRef.current = true
    } catch { /* ignore */ }

    return () => {
      try { recognition.stop() } catch { /* ignore */ }
      voiceListeningRef.current = false
    }
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

  const cancelSOS = useCallback(async () => {
    if (mediaRecorder) { try { mediaRecorder.stop() } catch { /* ignore */ } }
    if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()) }
    setMediaRecorder(null)
    setRecordingStream(null)

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
  }, [setSosActive, setSosAlert, mediaRecorder, recordingStream])

  useEffect(() => () => clearTimers(), [clearTimers])

  if (sosActive) {
    return (
      <>
        {/* Video oculto siempre en el DOM — mantiene el stream vivo al minimizar */}
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          className="fixed -top-[9999px] -left-[9999px] w-px h-px"
        />

        {/* OVERLAY completo */}
        {!minimized && (
          <div className="fixed inset-0 z-[200] bg-destructive/10 backdrop-blur-sm overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-8">
              <div className="w-full max-w-sm space-y-4">

                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                    <span className="font-semibold">SOS ACTIVO</span>
                  </div>
                  {/* Botón minimizar invisible — mantiene el layout centrado */}
                  <button
                    onClick={() => setMinimized(true)}
                    className="opacity-0 pointer-events-none flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Video preview */}
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

                {/* Ubicación */}
                {coordinates && (
                  <div className="p-3 bg-card rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">Tu ubicación</p>
                    <p className="font-mono text-sm text-foreground">
                      {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {/* Contactos notificados */}
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

                {/* Ver en Mapa */}
                <button
                  onClick={() => { setMinimized(true); setActiveTab('map') }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary font-medium text-sm hover:bg-primary/90 transition-colors !text-black dark:!text-white"
                >
                  Ver en Mapa
                </button>

                {/* Guardar y cerrar */}
                <button
                  onClick={() => setMinimized(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-card border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
                >
                  Guardar y cerrar alerta
                </button>

                {/* Detener / Reanudar grabación */}
                {recordingStream ? (
                  <button
                    onClick={() => {
                      if (mediaRecorder) { try { mediaRecorder.stop() } catch { /**/ } }
                      recordingStream.getTracks().forEach(t => t.stop())
                      setRecordingStream(null)
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
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(
                          () => navigator.mediaDevices.getUserMedia({ audio: true })
                        )
                        setRecordingStream(stream)
                        const recorder = new MediaRecorder(stream)
                        recorder.start()
                        setMediaRecorder(recorder)
                        setIsRecording(true)
                      } catch { /* sin permisos */ }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm hover:bg-muted transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    Reanudar grabación
                  </button>
                )}

                {/* Falsa alarma */}
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

        {/* BURBUJA FLOTANTE cuando está minimizado */}
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

        {/* DIÁLOGO falsa alarma */}
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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 safe-area-bottom flex flex-col items-center gap-2">
      <div
        className="absolute -top-8 w-20 h-8 opacity-0 cursor-pointer"
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
          "relative w-20 h-20 rounded-full bg-destructive text-destructive-foreground",
          "flex items-center justify-center",
          "shadow-lg shadow-destructive/30",
          "transition-transform active:scale-95",
          isHolding && "sos-pulse"
        )}
        aria-label="Mantén presionado 2 segundos para activar SOS"
      >
        {isHolding && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - holdProgress / 100)}`}
              className="opacity-50"
            />
          </svg>
        )}
        <div className="flex flex-col items-center">
          <AlertTriangle className="w-8 h-8" />
          <span className="text-xs font-bold mt-0.5">SOS</span>
        </div>
      </button>

      {isHolding && (
        <p className="whitespace-nowrap text-sm text-muted-foreground">Mantén presionado...</p>
      )}
    </div>
  )
}