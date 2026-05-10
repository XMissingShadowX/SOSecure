'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, AlertTriangle, WifiOff, Wifi, Radio } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DuringTab() {
  const { sosActive, setSosActive, contacts, locationHistory } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })
  const [isOnline, setIsOnline] = useState(true)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null)

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
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 3000)
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0
      playAlarmSound()
      sendAlarmNotification('🚨 SOS Activado', 'Alerta enviada por secuencia de botones', true)
      setSosActive(true)
    }
  }, [setSosActive])

  const toggleAudio = useCallback(async () => {
    if (isRecordingAudio) {
      audioRecorder?.stop()
      audioStream?.getTracks().forEach(t => t.stop())
      setAudioStream(null)
      setAudioRecorder(null)
      setIsRecordingAudio(false)
      // Save recording locally
      if (audioChunks.length) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `sosecure-audio-${Date.now()}.webm`; a.click()
      }
      setAudioChunks([])
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setAudioStream(stream)
        const recorder = new MediaRecorder(stream)
        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => chunks.push(e.data)
        recorder.onstop = () => setAudioChunks(chunks)
        recorder.start()
        setAudioRecorder(recorder)
        setIsRecordingAudio(true)
      } catch {
        sendAlarmNotification('⚠️ SOSecure', 'No se pudo acceder al micrófono')
      }
    }
  }, [isRecordingAudio, audioRecorder, audioStream, audioChunks])

  const toggleVideo = useCallback(async () => {
    if (isRecordingVideo) {
      videoStream?.getTracks().forEach(t => t.stop())
      setVideoStream(null)
      setIsRecordingVideo(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        setVideoStream(stream)
        if (videoRef.current) videoRef.current.srcObject = stream
        setIsRecordingVideo(true)
      } catch {
        sendAlarmNotification('⚠️ SOSecure', 'No se pudo acceder a la cámara')
      }
    }
  }, [isRecordingVideo, videoStream])

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
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={handleSecretTap}
          >
            Toque secreto ({5 - tapCountRef.current > 0 ? 5 - tapCountRef.current : 0} restantes)
          </Button>
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
          {isRecordingVideo && (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-destructive rounded text-xs text-white font-bold">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
              </div>
            </div>
          )}

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
              <p className="text-sm text-destructive font-medium">Grabando audio... Al detener, se descargará automáticamente</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Las grabaciones se guardan localmente en tu dispositivo
          </p>
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
