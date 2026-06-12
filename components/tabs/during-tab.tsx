/*
  Este componente representa la pestaña "Durante" de la aplicación SOSecure, donde el usuario puede activar un modo de 
  emergencia, grabar audio y video como evidencia, y ver su historial de ubicación reciente. El componente maneja el 
  estado de la grabación, la conexión a internet, y la interacción con los contactos de emergencia. También incluye 
  una función de activación secreta para situaciones donde el usuario no puede activar el modo de emergencia de 
  forma convencional. La UI está diseñada para ser clara y fácil de usar en situaciones de estrés, con indicadores 
  visuales del estado actual y opciones rápidas para compartir información crítica.
*/

// Importar hooks de React para manejar el estado, referencias, efectos y callbacks, así como iconos de 
// la biblioteca lucide-react para la interfaz de usuario. También se importan funciones y componentes personalizados 
// para manejar la lógica de grabación, geolocalización, notificaciones, y la interfaz de usuario.
'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, AlertTriangle, WifiOff, Wifi, Radio, Save, Send, Upload, CheckCircle, MessageCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  saveRecordingLocally,
  sendRecordingToContacts,
  uploadRecordingToDB,
  generateRecordingId,
  type RecordingMeta,
} from '@/lib/recordings'

// Función para realizar geocodificación inversa utilizando la API de Photon, que toma latitud y longitud como entrada
// y devuelve una dirección legible. Si la API falla o no devuelve resultados, se muestra la latitud y longitud formateadas.
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Se realiza una solicitud a la API de Photon para obtener la dirección basada en las coordenadas proporcionadas.
  try {
    // La URL de la API incluye los parámetros de latitud, longitud y un límite de resultados para obtener 
    // solo la mejor coincidencia.
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`,
      { headers: { Accept: 'application/json' } }
    )
    // Si la respuesta no es exitosa, se lanza un error para ser manejado en el bloque catch.
    if (!res.ok) throw new Error('photon error')
    // Se parsea la respuesta JSON para extraer la información de la dirección. Si no se encuentra una característica
    // válida, se devuelve la latitud y longitud formateadas. Si se encuentra una característica, se construye una 
    // dirección legible utilizando los campos disponibles, priorizando el nombre de la calle, número, distrito y ciudad.
    const data = await res.json()
    const f = data.features?.[0]
    if (!f) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    // Se extraen las propiedades relevantes de la característica para construir la dirección. Se priorizan los campos
    // de la siguiente manera: para la calle se usa 'street' o 'name', para el número se usa 'housenumber', para el distrito
    // se usa 'district' o 'suburb', y para la ciudad se usa 'city', 'town' o 'village'. Si no hay información de calle,
    // se muestra el nombre del lugar y la ciudad, o las coordenadas si no hay información disponible.
    const p = f.properties ?? {}
    const street   = p.street ?? p.name ?? ''
    const number   = p.housenumber ?? ''
    const district = p.district ?? p.suburb ?? ''
    const city     = p.city ?? p.town ?? p.village ?? ''
    
    // Si hay información de calle, se construye una dirección con el formato "Calle Número, Distrito/Ciudad". 
    // Si no hay información de calle, se muestra el nombre del lugar y la ciudad, o las coordenadas si no hay 
    // información disponible.
    if (street) {
      const parts = [street + (number ? ' ' + number : ''), district || city].filter(Boolean)
      return parts.join(', ')
    }
    return [p.name, city].filter(Boolean).join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    // En caso de cualquier error durante la solicitud o el procesamiento de la respuesta, se devuelve la latitud y
    // longitud formateadas como fallback.
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

// Hook personalizado para manejar la obtención de nombres de calles basados en el historial de ubicaciones. 
// Este hook toma un array de objetos de historial de ubicación, cada uno con coordenadas y una marca de tiempo, 
// y devuelve un objeto con los nombres de las calles correspondientes a esas coordenadas, así como los últimos 
// 5 registros de ubicación para mostrar en la interfaz.
function useStreetNames(locationHistory: { coordinates: { latitude: number; longitude: number }; timestamp: number }[]) {
  // Se utiliza un estado local para almacenar un mapa de coordenadas formateadas a nombres de calles, y una referencia para
  // mantener un conjunto de coordenadas que están actualmente pendientes de geocodificación para evitar solicitudes duplicadas.
  const [streetNames, setStreetNames] = useState<Record<string, string>>({})
  const pendingRef = useRef<Set<string>>(new Set())
  const last5 = locationHistory.slice(-5)

  // Efecto para realizar geocodificación inversa de las últimas 5 ubicaciones en el historial. Para cada ubicación, 
  // se formatea una clave basada en las coordenadas con 5 decimales de precisión. Si el nombre de la calle para 
  // esa clave ya está almacenado o está pendiente de geocodificación, se omite. De lo contrario, se agrega a 
  // la lista de pendientes y se realiza una solicitud de geocodificación inversa. Cuando se recibe el nombre 
  // de la calle, se actualiza el estado con el nuevo nombre y se elimina la clave de la lista de pendientes.
  useEffect(() => {
    // Se itera sobre las últimas 5 ubicaciones del historial para obtener los nombres de las calles correspondientes 
    // a sus coordenadas.
    for (const loc of last5) {
      // Se formatea una clave única para cada ubicación basada en las coordenadas, con 5 decimales de precisión 
      // para evitar solicitudes redundantes por pequeñas variaciones en la ubicación.
      const key = `${loc.coordinates.latitude.toFixed(5)},${loc.coordinates.longitude.toFixed(5)}`
      // Si el nombre de la calle para esta clave ya está almacenado o está pendiente de geocodificación, 
      // se omite esta ubicación.
      if (streetNames[key] || pendingRef.current.has(key)) continue
      pendingRef.current.add(key)
      reverseGeocode(loc.coordinates.latitude, loc.coordinates.longitude).then((name) => {
        setStreetNames(prev => ({ ...prev, [key]: name }))
        pendingRef.current.delete(key)
      })
    }
  // El efecto se ejecuta cada vez que cambia el historial de ubicaciones, asegurando que se actualicen los nombres 
  // de las calles
  }, [locationHistory.length])

  // El hook devuelve un objeto con los nombres de las calles correspondientes a las coordenadas del historial de ubicaciones,
  return { streetNames, last5 }
}

// Componente principal para la pestaña "Durante" de la aplicación SOSecure, que maneja el estado y la lógica 
// para el modo de emergencia activo, la grabación de audio y video, la conexión a internet, y la interacción 
// con los contactos de emergencia.
export function DuringTab() {
  const { sosActive, setSosActive, contacts, locationHistory, voiceKeyword, currentLocation: coordinates, sosStream } = useAppStore()
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
  const videoRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const videoStartRef = useRef<number>(0)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [tapCountDisplay, setTapCountDisplay] = useState(0)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  // Efecto para manejar los eventos de conexión y desconexión a internet, actualizando el estado de conexión en consecuencia.
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  // Función para manejar la secuencia de taps en el botón de activación secreta. Cada tap incrementa un contador 
  // y muestra el número de taps restantes para activar SOS. Si el usuario no completa la secuencia en 3 segundos, 
  // el contador se reinicia. Si el usuario completa la secuencia de 5 taps, se activa SOS mediante un evento personalizado.
  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1
    setTapCountDisplay(tapCountRef.current)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0
      setTapCountDisplay(0)
    }, 3000)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      setTapCountDisplay(0)
      window.dispatchEvent(new CustomEvent('sosecure:activate'))
    }
  }, [])

  // Función para alternar la grabación de audio. Si ya se está grabando, se detiene la grabación, se liberan 
  // los recursos del micrófono,
  const toggleAudio = useCallback(async () => {
    // Si ya se está grabando audio, se detiene la grabación, se liberan los recursos del micrófono, y 
    // se actualiza el estado para reflejar que no se está grabando.
    if (isRecordingAudio) {
      // Detener la grabación de audio si ya está activa, liberando los recursos del micrófono y actualizando el 
      // estado para reflejar que la grabación ha terminado. Los datos de audio grabados se procesarán en el 
      // evento 'onstop' del MediaRecorder, por lo que no se hace nada adicional aquí.
      audioRecorder?.stop()
      audioStream?.getTracks().forEach(t => t.stop())
      setAudioStream(null)
      setAudioRecorder(null)
      setIsRecordingAudio(false)
      // Los chunks llegan en onstop — no hacer nada aquí
    } else {
      // Si no se está grabando, se intenta acceder al micrófono para iniciar una nueva grabación. Si el acceso es 
      // exitoso, se configura el MediaRecorder para manejar los datos de audio y se actualiza el estado para 
      // reflejar que la grabación ha comenzado.
      try {
        setRecordingError(null)
        if (!navigator.mediaDevices?.getUserMedia && !sosStream) {
          setRecordingError('Micrófono no disponible en contexto no seguro (HTTP). Usa la app instalada o HTTPS.')
          return
        }
        const stream = sosStream
          ? new MediaStream(sosStream.getAudioTracks())
          : await navigator.mediaDevices.getUserMedia({ audio: true })
        setAudioStream(stream)
        audioStartRef.current = Date.now()
        audioChunksRef.current = []
        const audioMime =
          MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
          MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
          MediaRecorder.isTypeSupported('video/webm;codecs=opus') ? 'video/webm;codecs=opus' :
          MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
        const recorder = audioMime ? new MediaRecorder(stream, { mimeType: audioMime }) : new MediaRecorder(stream)
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        
        recorder.onstop = () => {
          // Cuando se detiene la grabación, se verifica si hay chunks de audio grabados. Si los hay, 
          // se crea un Blob con los datos de audio, se construye un objeto de metadatos para la grabación, 
          // y se actualiza el estado con la información de la última grabación.
          if (audioChunksRef.current.length) {
            // Se crea un Blob con los datos de audio grabados, y se construye un objeto de metadatos 
            // que incluye información
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

            // Se actualiza el estado con la información de la última grabación, y se muestra un mensaje al usuario 
            // indicando que la grabación está lista y preguntando qué desea hacer con ella.
            setLastRecording(meta)
            setStatusMsg('Grabación lista. ¿Qué deseas hacer?')
            setRecordingStatus('idle')
          }

          // Limpiar los chunks de audio después de procesar la grabación para liberar memoria.
          audioChunksRef.current = []
        }
        // Iniciar la grabación de audio, configurando el MediaRecorder para generar datos en chunks cada 100ms para 
        // asegurar que se capturen los datos de audio de manera continua.
        recorder.start(100) // chunk cada 100ms para asegurar datos
        setAudioRecorder(recorder)
        setIsRecordingAudio(true)
        setLastRecording(null)
        setStatusMsg('')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setRecordingError(`Micrófono: ${msg}`)
      }
    }
  }, [isRecordingAudio, audioRecorder, audioStream, coordinates, sosStream])

  // Guardar localmente 
  const handleSaveLocally = useCallback(() => {
    // Si no hay una grabación disponible, no se hace nada. Si hay una grabación, se actualiza el estado 
    // para reflejar que se está guardando la grabación, se llama a la función para guardar la grabación 
    // localmente, y se muestra un mensaje al usuario indicando que la descarga ha sido iniciada en su dispositivo. 
    // Finalmente, se actualiza el estado para reflejar que la acción de guardado ha sido completada.
    if (!lastRecording) return
    setRecordingStatus('saving')
    saveRecordingLocally(lastRecording)
    setStatusMsg('✅ Descarga iniciada en tu dispositivo')
    setRecordingStatus('done')
  }, [lastRecording])

  // Enviar a contactos
  const handleSendToContacts = useCallback(async () => {
    // Si no hay una grabación disponible, no se hace nada. Si hay una grabación, se actualiza el estado para 
    // reflejar que se está enviando la grabación, se muestra un mensaje al usuario indicando que se está enviando 
    // a los contactos, y se llama a la función para enviar la grabación a los contactos de emergencia. Cuando se 
    // recibe el resultado de la operación, se muestra un mensaje al usuario indicando si el envío fue exitoso o 
    // si hubo un error, y se actualiza el estado para reflejar que la acción de envío ha sido completada.
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

  // Enviar grabación por chat interno
  const handleSendViaChat = useCallback(async () => {
    if (!lastRecording) return
    setRecordingStatus('sending')
    setStatusMsg('Subiendo y enviando por chat...')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatusMsg('⚠️ Inicia sesión para usar el chat')
      setRecordingStatus('idle')
      return
    }

    const ext = lastRecording.mimeType.includes('mp4') ? 'mp4' : 'webm'
    const path = `${user.id}/${lastRecording.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('recordings')
      .upload(path, lastRecording.blob, { contentType: lastRecording.mimeType, upsert: false })
    if (upErr) {
      setStatusMsg('⚠️ Error al subir el archivo')
      setRecordingStatus('idle')
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(path)
    const prefix = lastRecording.type === 'audio' ? '🎵 Audio de emergencia' : '🎥 Video de emergencia'
    const content = `${prefix}:\n${publicUrl}`

    let sent = 0
    const primaryContacts = contacts.filter(c => c.importance === 'primary' || c.importance === 'secondary')
    for (const c of primaryContacts) {
      const email = (c as any).email as string | undefined
      if (email) {
        const { data: receiverId } = await supabase.rpc('get_user_id_by_email', { p_email: email })
        if (receiverId && receiverId !== user.id) {
          await supabase.from('chat_messages').insert({
            sender_id: user.id,
            receiver_id: receiverId,
            content,
            type: 'media',
          })
          sent++
        }
      }
    }

    setStatusMsg(sent > 0 ? `✅ Enviado a ${sent} contacto(s) por chat` : '⚠️ Ningún contacto tiene cuenta SOSecure')
    setRecordingStatus('done')
  }, [lastRecording, contacts])

  // Subir a base de datos
  const handleUploadToDB = useCallback(async () => {
    // Si no hay una grabación disponible, no se hace nada. Si hay una grabación, se actualiza el estado para 
    // reflejar que se está subiendo la grabación, se muestra un mensaje al usuario indicando que se está subiendo 
    // a la nube, y se llama a la función para subir la grabación a la base de datos. Cuando se recibe el resultado 
    // de la operación, se muestra un mensaje al usuario indicando si la subida fue exitosa o si hubo un error, 
    // y se actualiza el estado para reflejar que la acción de subida ha sido completada.
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

  // Función para alternar la grabación de video. Si ya se está grabando, se detiene la grabación y se liberan los recursos 
  // del video. Si no se está grabando, se intenta acceder a la cámara para iniciar una nueva grabación.
  const toggleVideo = useCallback(async () => {
    // Si ya se está grabando video, se detiene la grabación, se liberan los recursos de la cámara, y se actualiza el estado 
    // para reflejar que no se está grabando. Los datos de video grabados se procesarán en el evento 'onstop' del MediaRecorder, 
    // por lo que no se hace nada adicional aquí.
    if (isRecordingVideo) {
      videoRecorderRef.current?.stop()
      videoStream?.getTracks().forEach(t => t.stop())
      setVideoStream(null)
      setIsRecordingVideo(false)
    } 
    // Si no se está grabando video, se intenta acceder a la cámara para iniciar una nueva grabación. Si el acceso es exitoso,
    // se configura el MediaRecorder para manejar los datos de video y se actualiza el estado para reflejar que la grabación ha comenzado.
    else {
      // Se solicita acceso a la cámara utilizando la API de getUserMedia, con la configuración para usar la cámara 
      // trasera y capturar audio. Si el usuario concede el acceso, se obtiene un stream de video que se almacena en 
      // el estado. Se inicializan las referencias para el tiempo de inicio de la grabación y los chunks de video, y 
      // se crea un MediaRecorder para manejar la grabación de video. Se configuran los eventos 'ondataavailable' 
      // para almacenar los chunks de video a medida que se generan, y 'onstop' para procesar los datos de video 
      // grabados cuando se detiene la grabación. Finalmente, se inicia la grabación y se actualiza el estado para 
      // reflejar que la grabación de video está activa.
      try {
        setRecordingError(null)
        if (!navigator.mediaDevices?.getUserMedia && !sosStream) {
          setRecordingError('Cámara no disponible en contexto no seguro (HTTP). Usa la app instalada o HTTPS.')
          return
        }
        const stream = sosStream
          ? new MediaStream([...sosStream.getVideoTracks(), ...sosStream.getAudioTracks()])
          : await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            }).catch(
              () => navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            ).catch(
              () => navigator.mediaDevices.getUserMedia({ audio: true })
            )
        // Si se obtiene el stream de video, se asigna al elemento de video para mostrar la vista previa al usuario.
        setVideoStream(stream)
        setIsRecordingVideo(true)
        setLastRecording(null)
        setStatusMsg('')
        videoChunksRef.current = []
        videoStartRef.current = Date.now()

        // Se asigna el stream al elemento de video para mostrar la vista previa al usuario mientras graba.
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4'

        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunksRef.current.push(e.data)
        }
        
        // Cuando se detiene la grabación de video, se verifica si hay chunks de video grabados. Si los hay, se crea un Blob con
        // los datos de video, se construye un objeto de metadatos para la grabación, y se actualiza el estado con la información 
        // de la última grabación. Finalmente, se limpia la referencia de los chunks de video para liberar memoria.
        recorder.onstop = () => {
          if (videoChunksRef.current.length) {
            const blob = new Blob(videoChunksRef.current, { type: mimeType })
            const meta: RecordingMeta = {
              id: generateRecordingId(),
              blob,
              type: 'video',
              mimeType,
              durationMs: Date.now() - videoStartRef.current,
              createdAt: new Date().toISOString(),
              latitude: coordinates?.latitude,
              longitude: coordinates?.longitude,
            }
            setLastRecording(meta)
            setStatusMsg('Video listo. ¿Qué deseas hacer?')
            setRecordingStatus('idle')
          }
          videoChunksRef.current = []
        }
        recorder.start(100)
        videoRecorderRef.current = recorder
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setRecordingError(`Cámara: ${msg}`)
      }
    }
  }, [isRecordingVideo, videoStream, coordinates, sosStream])

  // Se utiliza el hook personalizado useStreetNames para obtener los nombres de las calles correspondientes 
  // a las coordenadas del historial de ubicaciones, y se extraen los últimos 5 registros de ubicación para 
  // mostrar en la interfaz.
  const { streetNames, last5: lastLocations } = useStreetNames(locationHistory)

  // La función principal del componente devuelve la interfaz de usuario para la pestaña "Durante", que incluye un 
  // indicador del estado de SOS, opciones para activar SOS de forma secreta, y controles para grabar audio y video. 
  // También muestra el estado de la conexión a internet y proporciona opciones para guardar o compartir las 
  // grabaciones realizadas durante el modo de emergencia.
  return (
    <div className="flex flex-col gap-6 pb-40">
      {/* Status */}
      <Card className={sosActive ? 'border-destructive bg-destructive/10' : 'border-primary/30 bg-primary/5'}>
        <CardContent className="flex items-center justify-center gap-3 py-2 px-3">
          <Radio className={`w-5 h-5 shrink-0 ${sosActive ? 'text-destructive animate-pulse' : 'text-primary'}`} />
          <div className="text-center">
            <p className="font-semibold text-base">{sosActive ? '🚨 SOS ACTIVO' : 'Modo DURANTE'}</p>
            <div className="flex items-center justify-center gap-1.5">
              {isOnline ? <Wifi className="w-3 h-3 text-safe" /> : <WifiOff className="w-3 h-3 text-destructive" />}
              <p className="text-sm text-muted-foreground">{isOnline ? 'En línea' : 'Sin internet'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secret activation */}
      <Card>
        <CardHeader className="pb-0">
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
              <div className="flex-1">
                <p className="text-sm font-medium">Activación por voz</p>
                {voiceKeyword ? (
                  <p className="text-xs text-muted-foreground">
                    Di <span className="font-semibold text-foreground">&quot;{voiceKeyword}&quot;</span> para activar SOS
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin palabra clave — configúrala en la pestaña <span className="font-medium">Antes</span>
                  </p>
                )}
              </div>
              {voiceKeyword && !sosActive && (
                <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Escuchando
                </span>
              )}
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
              {Math.max(0, 3 - tapCountDisplay)}
            </span>
          </button>
        </CardContent>
      </Card>

      {/* Recording */}
      <Card>
        <CardHeader className="pb-0">
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

          {recordingError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              ⚠️ {recordingError}
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
                    onClick={handleSendViaChat}
                    disabled={recordingStatus !== 'idle'}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Enviar por Chat de Emergencia
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
        <CardHeader className="pb-0">
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
                  <span className="text-muted-foreground">{streetNames[`${loc.coordinates.latitude.toFixed(5)},${loc.coordinates.longitude.toFixed(5)}`] ?? '📍 Cargando...'}</span>
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
