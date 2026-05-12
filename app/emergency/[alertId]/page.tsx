'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, MapPin, Clock, AlertTriangle } from 'lucide-react'

export default function EmergencyPage({ params }: { params: { alertId: string } }) {
  const { alertId } = params
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [alert, setAlert] = useState<any>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()

    const loadAlert = async () => {
      const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .eq('id', alertId)
        .single()
      if (data) setAlert(data)
      setLoading(false)
    }

    const loadLocation = async () => {
      const { data } = await supabase
        .from('sos_locations')
        .select('*')
        .eq('alert_id', alertId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (data) {
        setLocation({ latitude: data.latitude, longitude: data.longitude })
        setLastUpdate(new Date(data.updated_at))
      }
    }

    loadAlert()
    loadLocation()

    // Suscripción en tiempo real
    const channel = supabase
      .channel(`sos-location-${alertId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sos_locations',
        filter: `alert_id=eq.${alertId}`,
      }, (payload: any) => {
        if (payload.new) {
          setLocation({ latitude: payload.new.latitude, longitude: payload.new.longitude })
          setLastUpdate(new Date(payload.new.updated_at))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [alertId])

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (!location || !mapRef.current || typeof window === 'undefined') return

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView(
          [location.latitude, location.longitude], 16
        )
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current)

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:#ef4444;border:4px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(239,68,68,0.3),0 2px 8px rgba(0,0,0,0.3);animation:pulse 2s infinite"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        markerRef.current = L.marker([location.latitude, location.longitude], { icon }).addTo(mapInstanceRef.current)
      } else {
        markerRef.current?.setLatLng([location.latitude, location.longitude])
        mapInstanceRef.current.setView([location.latitude, location.longitude], 16)
      }
    }

    initMap()
  }, [location])

  if (loading) return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-red-600">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-medium">Cargando alerta de emergencia...</span>
      </div>
    </div>
  )

  if (!alert) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Alerta no encontrada</h1>
        <p className="text-gray-500 mt-2">Esta alerta no existe o ya fue cancelada.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-red-50">
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.3), 0 2px 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(239,68,68,0.1), 0 2px 8px rgba(0,0,0,0.3); }
        }
      `}</style>

      {/* Header */}
      <div className="bg-red-600 text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <h1 className="text-2xl font-bold">🚨 ALERTA SOS ACTIVA</h1>
          </div>
          <p className="text-red-100 text-sm">
            Activada el {new Date(alert.created_at).toLocaleString('es-MX')}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Estado */}
        <div className="bg-white rounded-xl border-2 border-red-200 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-800">Esta persona necesita ayuda</p>
              <p className="text-sm text-gray-500">
                Estado: <span className="font-medium text-red-600">{alert.status === 'active' ? 'Alerta activa' : 'Resuelta'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Última actualización */}
        {lastUpdate && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Última ubicación recibida</p>
              <p className="font-medium text-gray-800">{lastUpdate.toLocaleTimeString('es-MX')}</p>
            </div>
          </div>
        )}

        {/* Mapa */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" />
            <p className="font-medium text-gray-800">Ubicación en tiempo real</p>
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

        {/* Botón Google Maps */}
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