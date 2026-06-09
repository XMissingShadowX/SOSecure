/*
  SOSecure - Sistema de Alerta Personal para Emergencias
  Página de Detalles de Alerta

  Esta página muestra los detalles de una alerta de emergencia específica, incluyendo la ubicación en tiempo real, el estado de la alerta y un video grabado durante la emergencia (si está disponible). La página se actualiza automáticamente para reflejar los cambios en la ubicación y el estado de la alerta.
  Si la alerta ya fue resuelta, la página seguirá mostrando la última ubicación registrada y el video, pero indicará claramente que la alerta ha sido resuelta.
*/

'use client'

// Importar hooks de React, la función para crear un cliente de Supabase y componentes de UI
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { liveChannelName, type LiveFramePayload, type LiveStatusPayload } from '@/lib/live-stream'
import { Shield, MapPin, Clock, AlertTriangle } from 'lucide-react'
import { use } from 'react'

// Este componente principal de la página de detalles de alerta recibe el ID de la alerta como parámetro y 
// maneja la lógica para cargar los datos de la alerta, la ubicación y el video, así como para renderizar 
// la interfaz de usuario correspondiente según el estado de la alerta y la disponibilidad de los datos.
export default function EmergencyPage({ params }: { params: Promise<{ alertId: string }> }) {
  // Obtener el ID de la alerta de los parámetros de la ruta y definir estados para la ubicación, alerta, 
  // última actualización, estado de carga y URL del video
  const { alertId } = use(params)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [alert, setAlert] = useState<any>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  // ── Video EN VIVO ────────────────────────────────────────────────
  const [liveFrame, setLiveFrame] = useState<string | null>(null)
  const [liveLastTs, setLiveLastTs] = useState<number | null>(null)
  const [tick, setTick] = useState(0) // fuerza re-render para recalcular "frescura" del feed
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // Cargar los datos de la alerta y la ubicación al montar el componente, y configurar intervalos para 
  // actualizar la ubicación y el video automáticamente
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la base de datos
    const supabase = createClient()

    // Función para cargar los datos de la alerta, incluyendo su estado y URL del video si está disponible
    const loadAlert = async () => {
      // Consultar la alerta específica por su ID y actualizar el estado con los datos obtenidos, incluyendo 
      // la URL del video si está disponible
      const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .eq('id', alertId)
        .single()

      // Si se obtiene la alerta, actualizar el estado de la alerta y la URL del video si está disponible
      if (data) {
        setAlert(data)
        if (data.video_url) setVideoUrl(data.video_url)
      }

      // Marcar que la carga inicial ha terminado después de obtener los datos de la alerta
      setLoading(false)
    }

    // Función para cargar la ubicación más reciente asociada a la alerta, actualizando el estado de la ubicación 
    // y la última actualización
    const loadLocation = async () => {
      // Consultar la ubicación más reciente asociada a la alerta por su ID, ordenada por fecha de actualización, 
      // y actualizar el estado de la ubicación y la última actualización si se obtiene un resultado
      const { data } = await supabase
        .from('sos_locations')
        .select('*')
        .eq('alert_id', alertId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      // Si se obtiene la ubicación, actualizar el estado de la ubicación y la última actualización con los datos obtenidos
      if (data) {
        setLocation({ latitude: data.latitude, longitude: data.longitude })
        setLastUpdate(new Date(data.updated_at))
      }
    }

    // Llamar a las funciones de carga para obtener los datos iniciales de la alerta y la ubicación, y configurar 
    // intervalos para actualizar la ubicación y el video automáticamente
    loadAlert()
    loadLocation()

    // Configurar intervalos para actualizar la ubicación cada segundo y el video cada 5 segundos, y limpiar los 
    // intervalos al desmontar el componente
    const interval = setInterval(loadLocation, 1000)

    // Configurar un intervalo para actualizar la URL del video cada 5 segundos, lo que permite mostrar el video grabado 
    // durante la emergencia tan pronto como esté disponible o se actualice
    const refreshVideo = setInterval(async () => {
      const { data } = await supabase
        .from('sos_alerts')
        .select('video_url')
        .eq('id', alertId)
        .single()

      // Si se obtiene la URL del video, actualizar el estado de la URL del video para mostrar el video grabado 
      // durante la emergencia
      if (data?.video_url) setVideoUrl(data.video_url)
    }, 5000)

    // Limpiar los intervalos al desmontar el componente para evitar fugas de memoria y llamadas innecesarias a 
    // la base de datos cuando el usuario navegue fuera de esta página
    return () => { clearInterval(interval); clearInterval(refreshVideo) }
  }, [alertId])

  // Suscribirse al canal de Realtime para recibir los fotogramas EN VIVO que envía
  // la persona en peligro desde su teléfono. Cada fotograma es una imagen JPEG (data URL).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(liveChannelName(alertId), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'frame' }, ({ payload }) => {
        const p = payload as LiveFramePayload
        if (p?.img) {
          setLiveFrame(p.img)
          setLiveLastTs(p.ts ?? Date.now())
        }
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        const p = payload as LiveStatusPayload
        if (p && p.live === false) setLiveLastTs(0) // transmisión terminada
      })
      .subscribe()

    // Recalcular cada 2s si el feed sigue "fresco" (llegó un fotograma reciente).
    const freshness = setInterval(() => setTick((t) => t + 1), 2000)

    return () => {
      clearInterval(freshness)
      try { supabase.removeChannel(channel) } catch { /* noop */ }
    }
  }, [alertId])

  // El feed se considera EN VIVO si llegó un fotograma en los últimos 8 segundos.
  const liveIsFresh = !!liveFrame && !!liveLastTs && Date.now() - liveLastTs < 8000
  const liveSecondsAgo = liveLastTs ? Math.max(0, Math.floor((Date.now() - liveLastTs) / 1000)) : null
  void tick // tick solo dispara el re-render para recomputar liveIsFresh

  // Configurar el mapa para mostrar la ubicación en tiempo real de la alerta, actualizando el marcador y 
  // la vista del mapa cada vez que se actualiza la ubicación
  useEffect(() => {
    // Si no hay ubicación, referencia al mapa o estamos en un entorno sin ventana (como durante la generación estática), 
    // no hacer nada
    if (!location || !mapRef.current || typeof window === 'undefined') return

    // Función para inicializar el mapa utilizando Leaflet, creando un marcador personalizado para la ubicación de la 
    // alerta y actualizando la vista del mapa cada vez que se actualiza la ubicación
    const initMap = async () => {
      // Importar Leaflet dinámicamente para evitar problemas de SSR y cargar los estilos necesarios para el mapa
      const L = (await import('leaflet')).default
      // @ts-ignore
      await import('leaflet/dist/leaflet.css')

      // Si el mapa aún no ha sido inicializado, crear una nueva instancia del mapa centrada en la ubicación actual y
      // agregar un marcador personalizado para indicar la ubicación de la alerta. Si el mapa ya ha sido inicializado,
      // simplemente actualizar la posición del marcador y la vista del mapa para reflejar la nueva ubicación.
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView(
          [location.latitude, location.longitude], 16
        )
        // Agregar una capa de mapa base utilizando los mapas de CartoDB para mostrar la ubicación de la alerta 
        // con un estilo claro y legible
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current)

        // Crear un marcador personalizado utilizando un div con estilos para mostrar un punto rojo pulsante que 
        // indique la ubicación de la alerta de emergencia, y agregarlo al mapa
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:#ef4444;border:4px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(239,68,68,0.3),0 2px 8px rgba(0,0,0,0.3);animation:pulse 2s infinite"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        // Agregar el marcador al mapa en la ubicación inicial de la alerta
        markerRef.current = L.marker([location.latitude, location.longitude], { icon }).addTo(mapInstanceRef.current)
      } else {
        markerRef.current?.setLatLng([location.latitude, location.longitude])
        mapInstanceRef.current.setView([location.latitude, location.longitude], 16)
      }
    }

    // Inicializar el mapa después de cargar la ubicación, y actualizarlo cada vez que se actualice la 
    // ubicación para mostrar la ubicación en tiempo real de la alerta
    initMap()
  }, [location])

  // Si la alerta aún se está cargando, mostrar una pantalla de carga con un mensaje y un indicador visual para 
  // informar al usuario que los datos de la alerta están siendo obtenidos
  if (loading) return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-red-600">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-medium">Cargando alerta de emergencia...</span>
      </div>
    </div>
  )

  // Si no se encuentra la alerta después de cargar, mostrar una pantalla de error indicando que la alerta 
  // no existe o ya fue eliminada del sistema, para informar al usuario de manera clara y evitar confusiones
  if (!alert) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Alerta no encontrada</h1>
        <p className="text-gray-500 mt-2">Esta alerta no existe o ya fue eliminada del sistema.</p>
      </div>
    </div>
  )
  // Alerta resuelta: mostrar interfaz completa con mapa y video, no bloquear acceso

  // Renderizar la página de detalles de alerta con información clara sobre el estado de la alerta, la ubicación 
  // en tiempo real, el video grabado durante la emergencia (si está disponible) y enlaces para abrir la 
  // ubicación en Google Maps, proporcionando una experiencia informativa y útil para los usuarios que 
  // necesitan acceder a esta información durante una emergencia o después de que haya sido resuelta.
  return (
    <div className="min-h-screen bg-red-50">
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.3), 0 2px 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(239,68,68,0.1), 0 2px 8px rgba(0,0,0,0.3); }
        }
      `}</style>

      <div className="bg-red-600 text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <h1 className="text-2xl font-bold">
              {alert.status === 'active' ? '🚨 ALERTA SOS ACTIVA' : '📋 ALERTA SOS — RESUELTA'}
            </h1>
          </div>
          <p className="text-red-100 text-sm">
            Activada el {new Date(alert.created_at).toLocaleString('es-MX')}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl border-2 border-red-200 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-800">
                {alert.status === 'active' ? 'Esta persona necesita ayuda' : 'Esta alerta ya fue resuelta'}
              </p>
              <p className="text-sm text-gray-500">
                Estado: <span className={`font-medium ${alert.status === 'active' ? 'text-red-600' : 'text-green-600'}`}>
                  {alert.status === 'active' ? 'Alerta activa' : 'Resuelta'}
                </span>
              </p>
              {alert.status !== 'active' && (
                <p className="text-xs text-gray-400 mt-1">
                  Puedes ver la última ubicación registrada y el video grabado durante la emergencia.
                </p>
              )}
            </div>
          </div>
        </div>

        {lastUpdate && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Última ubicación recibida</p>
              <p className="font-medium text-gray-800">{lastUpdate.toLocaleTimeString('es-MX')}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" />
            <p className="font-medium text-gray-800">
              {alert.status === 'active' ? 'Ubicación en tiempo real' : 'Última ubicación registrada'}
            </p>
            {location && (
              <span className="ml-auto text-xs text-gray-400 font-mono">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </span>
            )}
          </div>
          {location ? (
            <div ref={mapRef} style={{ height: '320px', width: '100%' }} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Esperando ubicación...</p>
              </div>
            </div>
          )}
        </div>

        {alert.status === 'active' && (
          <div className="bg-white rounded-xl border-2 border-red-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {liveIsFresh && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${liveIsFresh ? 'bg-red-600' : 'bg-gray-300'}`} />
              </span>
              <p className="font-medium text-gray-800">
                {liveIsFresh ? '🔴 Video EN VIVO' : 'Video en vivo'}
              </p>
              {liveIsFresh && liveSecondsAgo !== null && (
                <span className="ml-auto text-xs text-gray-400">
                  {liveSecondsAgo <= 1 ? 'ahora mismo' : `hace ${liveSecondsAgo}s`}
                </span>
              )}
            </div>
            <div className="bg-black">
              {liveIsFresh && liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Transmisión en vivo de la emergencia"
                  className="w-full object-contain"
                  style={{ maxHeight: '360px' }}
                />
              ) : (
                <div className="h-56 flex flex-col items-center justify-center gap-3 text-gray-300">
                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Conectando con la cámara en vivo…</p>
                  <p className="text-xs text-gray-500 px-6 text-center">
                    Verás la imagen en cuanto la persona active su cámara.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-lg">🎥</span>
              <p className="font-medium text-gray-800">Video grabado durante la alerta</p>
            </div>
            <div className="p-4">
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '320px' }}
              />
            </div>
          </div>
        )}

        {location && (
          <a
            href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            🗺️ Abrir en Google Maps
          </a>
        )}

        <p className="text-xs text-center text-gray-400 pb-4">
          Página generada por SOSecure · La ubicación se actualiza automáticamente
        </p>
      </div>
    </div>
  )
}