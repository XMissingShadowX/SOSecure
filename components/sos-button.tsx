'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, X, Bell, Mic, Video, StopCircle } from 'lucide-react'
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

// Secret button sequence: Volume-like tap pattern (5 taps in 3s)
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

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const tapTimesRef = useRef<number[]>([])
  const voiceListeningRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null }
  }, [])

  const activateSOS = useCallback(async () => {
    if (!coordinates) return

    setSosActive(true)
    setIsRecording(true)

    playAlarmSound()
    sendAlarmNotification('🚨 SOSecure SOS Activado', 'Alerta de emergencia enviada a tus contactos', true)

    // Start recording (audio + video if permitted)
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

  // Secret tap sequence activation
  const handleSecretTap = useCallback(() => {
    const now = Date.now()
    tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < SECRET_TAP_WINDOW), now]
    if (tapTimesRef.current.length >= SECRET_TAP_COUNT) {
      tapTimesRef.current = []
      activateSOS()
    }
  }, [activateSOS])

  // Voice activation listener
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
    // Stop recording
    if (mediaRecorder) { try { mediaRecorder.stop() } catch { /* ignore */ } }
    if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()) }
    setMediaRecorder(null)
    setRecordingStream(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('sos_alerts').update({ status: 'false_alarm', resolved_at: new Date().toISOString() }).eq('user_id', user.id).eq('status', 'active')
    }

    setSosActive(false)
    setSosAlert(null)
    setIsRecording(false)
    setContactsNotified([])
    setShowCancelDialog(false)
  }, [setSosActive, setSosAlert, mediaRecorder, recordingStream])

  useEffect(() => () => clearTimers(), [clearTimers])

  if (sosActive) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-destructive/10 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
            <div className="w-full max-w-sm space-y-6">
              <div className="flex items-center justify-center gap-2 text-destructive">
                <div className="w-3 h-3 rounded-full bg-destructive recording-indicator" />
                <span className="font-semibold">SOS ACTIVO</span>
              </div>

              {/* Recording UI */}
              <div className="relative aspect-video bg-card rounded-lg overflow-hidden border-2 border-destructive">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {recordingStream ? (
                    <>
                      <Video className="w-10 h-10 text-destructive animate-pulse" />
                      <Mic className="w-6 h-6 text-destructive animate-pulse" />
                      <p className="text-xs text-muted-foreground">Grabando audio/video...</p>
                    </>
                  ) : (
                    <Video className="w-12 h-12 text-muted-foreground animate-pulse" />
                  )}
                </div>
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 bg-destructive rounded text-xs text-destructive-foreground font-medium">
                    <div className="w-2 h-2 rounded-full bg-destructive-foreground recording-indicator" />
                    REC
                  </div>
                )}
              </div>

              {coordinates && (
                <div className="p-4 bg-card rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Tu ubicación</p>
                  <p className="font-mono text-sm">{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</p>
                </div>
              )}

              {contactsNotified.length > 0 && (
                <div className="p-4 bg-card rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Contactos notificados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contactsNotified.map((name) => (
                      <span key={name} className="px-2 py-1 bg-safe/20 text-safe rounded text-sm">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="lg" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setShowCancelDialog(true)}>
                <X className="w-5 h-5 mr-2" />
                Cancelar SOS
              </Button>

              <Button variant="secondary" size="lg" className="w-full" onClick={() => setActiveTab('map')}>
                Ver en Mapa
              </Button>

              {recordingStream && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => {
                  if (mediaRecorder) { try { mediaRecorder.stop() } catch {/**/ } }
                  recordingStream.getTracks().forEach(t => t.stop())
                  setRecordingStream(null)
                  setIsRecording(false)
                }}>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Detener grabación
                </Button>
              )}
            </div>
          </div>
        </div>

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar Alerta SOS?</AlertDialogTitle>
              <AlertDialogDescription>
                Esto marcará la alerta como falsa alarma. Tus contactos ya han sido notificados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Mantener Activo</AlertDialogCancel>
              <AlertDialogAction onClick={cancelSOS} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, Cancelar SOS
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 safe-area-bottom flex flex-col items-center gap-2">
      {/* Secret tap zone (invisible, top of SOS button area) */}
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
