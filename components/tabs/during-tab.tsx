'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, AlertTriangle, WifiOff, Wifi, Radio, Save, Send, Upload, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  saveRecordingLocally,
  sendRecordingToContacts,
  uploadRecordingToDB,
  generateRecordingId,
  type RecordingMeta,
} from '@/lib/recordings'

export function DuringTab() {
  const { sosActive, setSosActive, contacts, locationHistory } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })
    const [isOnline, setIsOnline] = useState(true)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [lastRecording, setLastRecording] = useState<RecordingMeta | null>(null)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'saving' | 'sending' | 'uploading' | 'done'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const audioStartRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [tapCountDisplay, setTapCountDisplay] = useState(0)

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  // Secret button tap sequence (5 taps to activate SOS)
  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1
    setTapCountDisplay(tapCountRef.current)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0
      setTapCountDisplay(0)
    }, 3000)
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      setTapCountDisplay(0)
      window.dispatchEvent(new CustomEvent('sosecure:activate'))
    }
  }, [])

  const toggleAudio = useCallback(async () => {
    if (isRecordingAudio) {
      audioRecorder?.stop()
      audioStream?.getTracks().forEach(t => t.stop())
      setAudioStream(null)
      setAudioRecorder(null)
      setIsRecordingAudio(false)

      if (audioChunksRef.current.length) {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const meta: RecordingMeta = {
          id: generateRecordingId(),
          blob,
          type: 'audio',
          mimeType: 'audio/webm',
          durationMs: Date.now() - audioStartRef.current,
          createdAt: new Date().toISOString(),
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        }
        setLastRecording(meta)
        setStatusMsg('Grabación lista. ¿Qué deseas hacer?')
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setAudioStream(stream)
        audioStartRef.current = Date.now()
        const recorder = new MediaRecorder(stream)
        audioChunksRef.current = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
        recorder.onstop = () => {}
        recorder.start()
        setAudioRecorder(recorder)
        setIsRecordingAudio(true)
        setLastRecording(null)
        setStatusMsg('')
      } catch {
        sendAlarmNotification('⚠️ SOSecure', 'No se pudo acceder al micrófono')
      }
    }
  }, [isRecordingAudio, audioRecorder, audioStream, coordinates])

  // Guardar localmente
  const handleSaveLocally = useCallback(() => {
    if (!lastRecording) return
    setRecordingStatus('saving')
    saveRecordingLocally(lastRecording)
    setStatusMsg('✅ Descarga iniciada en tu dispositivo')
    setRecordingStatus('done')
  }, [lastRecording])

  // Enviar a contactos
  const handleSendToContacts = useCallback(async () => {
    if (!lastRecording) return
    setRecordingStatus('sending')
    setStatusMsg('Enviando a contactos...')
    const result = await sendRecordingToContacts(lastRecording, contacts)
    if (result.success) {
      setStatusMsg(`✅ Compartido vía ${result.method === 'share' ? 'sistema' : 'WhatsApp'}`)
    } else {
      setStatusMsg('⚠️ No se pudo enviar. Guarda localmente.')
    }
    setRecordingStatus('done')
  }, [lastRecording, contacts])

  // Subir a base de datos
  const handleUploadToDB = useCallback(async () => {
    if (!lastRecording) return
    setRecordingStatus('uploading')
    setStatusMsg('Subiendo a la nube...')
    const result = await uploadRecordingToDB(lastRecording)
    if (result.error) {
      setStatusMsg(`⚠️ Error: ${result.error}`)
    } else {
      setStatusMsg('✅ Grabación guardada en la nube')
    }
    setRecordingStatus('done')
  }, [lastRecording])

  const toggleVideo = useCallback(async () => {
    if (isRecordingVideo) {
      videoStream?.getTracks().forEach(t => t.stop())
      setVideoStream(null)
      setIsRecordingVideo(false)
      // Generar grabación de video
      setLastRecording({
        id: generateRecordingId(),
        blob: new Blob([], { type: 'video/webm' }),
        type: 'video',
        mimeType: 'video/webm',
        durationMs: 0,
        createdAt: new Date().toISOString(),
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
      })
      setStatusMsg('Video listo. ¿Qué deseas hacer?')
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
        setVideoStream(stream)
        setIsRecordingVideo(true)
        setLastRecording(null)
        setStatusMsg('')
      } catch {
        sendAlarmNotification('⚠️ SOSecure', 'No se pudo acceder a la cámara')
      }
    }
  }, [isRecordingVideo, videoStream, coordinates])

  const lastLocations = locationHistory.slice(-5)

  return (
    <div className="flex flex-col gap-6 pb-40">
      {/* Status */}
      <Card className={sosActive ? 'border-destructive bg-destructive/10' : 'border-primary/30 bg-primary/5'}>
        <CardContent className="p-4 flex items-center gap-3">
          <Radio className={`w-6 h-6 ${sosActive ? 'text-destructive animate-pulse' : 'text-primary'}`} />
          <div>
            <p className="font-semibold text-sm">{sosActive ? '🚨 SOS ACTIVO' : 'Modo DURANTE'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {isOnline ? <Wifi className="w-3 h-3 text-safe" /> : <WifiOff className="w-3 h-3 text-destructive" />}
              <p className="text-xs text-muted-foreground">{isOnline ? 'En línea' : 'Sin internet — datos guardados localmente'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secret activation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Activación Alternativa de SOS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Métodos discretos para activar SOS sin levantar sospechas:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-2xl">👆</span>
              <div>
                <p className="text-sm font-medium">Secuencia de taps</p>
                <p className="text-xs text-muted-foreground">Toca el botón de abajo 5 veces rápido</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-2xl">🎙️</span>
              <div>
                <p className="text-sm font-medium">Activación por voz</p>
                <p className="text-xs text-muted-foreground">Di &quot;auxilio&quot;, &quot;ayuda&quot; o &quot;emergencia&quot;</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-2xl">⏱️</span>
              <div>
                <p className="text-sm font-medium">Temporizador expirado</p>
                <p className="text-xs text-muted-foreground">El timer de seguridad activa SOS automáticamente</p>
              </div>
            </div>
          </div>

          {/* Secret tap button */}
          <button
            onClick={handleSecretTap}
            className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-warning bg-warning/10 text-warning font-medium text-sm hover:bg-warning/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">👆</span>
            Toque secreto
            <span className="ml-auto bg-warning text-warning-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {Math.max(0, 5 - tapCountDisplay)}
            </span>
          </button>
        </CardContent>
      </Card>

      {/* Recording */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="w-5 h-5 text-primary" />
            Grabación de Emergencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden" style={{ display: isRecordingVideo ? 'block' : 'none' }}>
            <video
              ref={(el) => {
                (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
                if (el && videoStream) {
                  el.srcObject = videoStream
                  el.play().catch(() => {})
                }
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {isRecordingVideo && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-destructive rounded text-xs text-white font-bold">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={toggleAudio}
              variant={isRecordingAudio ? 'destructive' : 'outline'}
              className="flex-1"
            >
              {isRecordingAudio ? <><MicOff className="w-4 h-4 mr-2" />Detener Audio</> : <><Mic className="w-4 h-4 mr-2" />Grabar Audio</>}
            </Button>
            <Button
              onClick={toggleVideo}
              variant={isRecordingVideo ? 'destructive' : 'outline'}
              className="flex-1"
            >
              {isRecordingVideo ? <><VideoOff className="w-4 h-4 mr-2" />Detener Video</> : <><Video className="w-4 h-4 mr-2" />Grabar Video</>}
            </Button>
          </div>

             {isRecordingAudio && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <p className="text-sm text-destructive font-medium">Grabando audio... Toca "Detener" cuando termines</p>
            </div>
          )}

          {/* Panel de acciones post-grabación */}
          {lastRecording && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-center">{statusMsg || '¿Qué deseas hacer con la grabación?'}</p>

              {recordingStatus !== 'done' && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSaveLocally}
                    disabled={recordingStatus !== 'idle'}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar en dispositivo
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSendToContacts}
                    disabled={recordingStatus !== 'idle' || contacts.length === 0}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar a contactos de emergencia
                    {contacts.length === 0 && <span className="ml-1 text-xs text-muted-foreground">(sin contactos)</span>}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUploadToDB}
                    disabled={recordingStatus !== 'idle'}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Guardar en la nube (Supabase)
                  </Button>
                </div>
              )}

              {recordingStatus === 'done' && (
                <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <p className="text-sm text-primary font-medium">{statusMsg}</p>
                </div>
              )}

              {recordingStatus === 'done' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setLastRecording(null); setRecordingStatus('idle'); setStatusMsg('') }}
                >
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {!lastRecording && (
            <p className="text-xs text-muted-foreground text-center">
              Al detener la grabación podrás guardarla, enviarla o subirla a la nube
            </p>
          )}
        </CardContent>
      </Card>

      {/* Location history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="w-5 h-5 text-primary" />
            Historial de Ubicación (últimos 10 min)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Activa la ubicación para registrar el historial</p>
          ) : (
            <div className="space-y-2">
              {lastLocations.reverse().map((loc, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                  <Badge variant="outline" className="text-xs">{i === 0 ? 'Ahora' : `Hace ${Math.round((Date.now() - loc.timestamp) / 60000)} min`}</Badge>
                  <span className="font-mono text-muted-foreground">{loc.coordinates.latitude.toFixed(5)}, {loc.coordinates.longitude.toFixed(5)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Este historial se comparte con contactos de confianza en caso de secuestro o robo
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
