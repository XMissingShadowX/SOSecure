'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Clock, Shield, UserCheck, UserX, Eye } from 'lucide-react'
import { use } from 'react'
import type { TrackingSession, TrackingMember } from '@/lib/types'

const LOCATION_INTERVAL_MS = 30_000

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Sin actualizar'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10) return 'Ahora mismo'
  if (diffSec < 60) return `Hace ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  return `Hace ${Math.floor(diffMin / 60)}h`
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrackingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)

  // Leer ?member=xxx&token=yyy del query string
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)

  const [session, setSession] = useState<TrackingSession | null>(null)
  const [members, setMembers] = useState<TrackingMember[]>([])
  const [myMember, setMyMember] = useState<TrackingMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Parsear query params en el cliente
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setMemberId(sp.get('member'))
    setMemberToken(sp.get('token'))
  }, [])

  // Cargar sesión y validar token
  useEffect(() => {
    if (!memberId || !memberToken) return
    const supabase = createClient()

    const load = async () => {
      const { data: sess } = await supabase
        .from('tracking_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!sess) { setLoading(false); return }
      setSession(sess as TrackingSession)

      const { data: member } = await supabase
        .from('tracking_members')
        .select('*')
        .eq('id', memberId)
        .eq('session_id', sessionId)
        .eq('external_token', memberToken)
        .single()

      if (member) {
        setMyMember(member as TrackingMember)
        setTokenValid(true)
        setSharing((member as TrackingMember).is_sharing)
      }

      setLoading(false)
    }

    load()
  }, [sessionId, memberId, memberToken])

  // Subir ubicación del contacto vía API server-side (evita problemas de RLS)
  const uploadLocation = useCallback(async () => {
    if (!memberId || !memberToken || !tokenValid) return
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch('/api/tracking-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          token: memberToken,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      })
      setSharing(true)
    }, undefined, { enableHighAccuracy: true, timeout: 10000 })
  }, [memberId, memberToken, tokenValid])

  // Polling de todos los miembros
  const pollMembers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tracking_members')
      .select('*')
      .eq('session_id', sessionId)
    if (data) setMembers(data as TrackingMember[])

    // Refrescar estado de la sesión (para el temporizador)
    const { data: sess } = await supabase
      .from('tracking_sessions')
      .select('security_timer_end, status')
      .eq('id', sessionId)
      .single()
    if (sess) {
      setSession(prev => prev ? { ...prev, ...sess } : prev)
    }
  }, [sessionId])

  // Activar sharing cuando el token es válido
  useEffect(() => {
    if (!tokenValid) return

    uploadLocation()
    locationIntervalRef.current = setInterval(uploadLocation, LOCATION_INTERVAL_MS)

    pollMembers()
    pollIntervalRef.current = setInterval(pollMembers, LOCATION_INTERVAL_MS)

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [tokenValid, uploadLocation, pollMembers])

  // Countdown del temporizador de seguridad
  useEffect(() => {
    if (!session?.security_timer_end) { setCountdown(null); return }
    const tick = () => {
      const remaining = (session.security_timer_end as number) - Date.now()
      setCountdown(remaining > 0 ? remaining : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.security_timer_end])

  // Detener sharing
  const stopSharing = async () => {
    if (!memberId || !memberToken) return
    await fetch('/api/tracking-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, token: memberToken, isStopping: true }),
    })
    setSharing(false)
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
  }

  // Inicializar/actualizar mapa con todos los miembros
  useEffect(() => {
    if (!members.length || !mapRef.current || typeof window === 'undefined') return
    const membersWithLocation = members.filter(m => m.latitude && m.longitude)
    if (!membersWithLocation.length) return

    const initMap = async () => {
      const L = (await import('leaflet')).default
      // @ts-ignore
      await import('leaflet/dist/leaflet.css')

      const first = membersWithLocation[0]

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView(
          [first.latitude!, first.longitude!], 15
        )
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current)
      }

      membersWithLocation.forEach(m => {
        const isInitiator = m.is_initiator
        const color = isInitiator ? '#f97316' : '#3b82f6'
        const html = `<div style="width:22px;height:22px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px ${color}44,0 2px 6px rgba(0,0,0,0.25)"></div>`
        const icon = L.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] })

        if (markersRef.current[m.id]) {
          markersRef.current[m.id].setLatLng([m.latitude!, m.longitude!])
        } else {
          markersRef.current[m.id] = L.marker([m.latitude!, m.longitude!], { icon })
            .bindTooltip(m.display_name, { permanent: false, direction: 'top' })
            .addTo(mapInstanceRef.current)
        }
      })

      // Ajustar vista a todos los puntos
      if (membersWithLocation.length > 1) {
        const bounds = L.latLngBounds(membersWithLocation.map(m => [m.latitude!, m.longitude!] as [number, number]))
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] })
      } else {
        mapInstanceRef.current.setView([first.latitude!, first.longitude!], 15)
      }
    }

    initMap()
  }, [members])

  if (loading) return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-blue-600">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-medium">Cargando sesión de seguimiento...</span>
      </div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Sesión no encontrada</h1>
        <p className="text-gray-500 mt-2">Este enlace no es válido o la sesión ya terminó.</p>
      </div>
    </div>
  )

  if (!tokenValid) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-700">Enlace inválido</h1>
        <p className="text-gray-500 mt-2">El token de acceso no es correcto.</p>
      </div>
    </div>
  )

  const initiator = members.find(m => m.is_initiator)
  const otherMembers = members.filter(m => !m.is_initiator)

  return (
    <div className="min-h-screen bg-blue-50">
      <style>{`
        @keyframes pulse-blue {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 0 10px rgba(59,130,246,0.08); }
        }
      `}</style>

      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <h1 className="text-xl font-bold">
              {session.status === 'stopped' ? '📋 Seguimiento finalizado' : '📍 Seguimiento activo'}
            </h1>
          </div>
          <p className="text-blue-100 text-sm">
            {session.initiator_name} compartió este enlace contigo
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Temporizador de seguridad */}
        {countdown !== null && session.status === 'active' && (
          <div className={`rounded-xl border-2 p-4 ${countdown < 5 * 60 * 1000 ? 'bg-red-50 border-red-200' : 'bg-white border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${countdown < 5 * 60 * 1000 ? 'text-red-500' : 'text-blue-500'}`} />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Temporizador de seguridad</p>
                <p className={`text-2xl font-mono font-bold ${countdown < 5 * 60 * 1000 ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatCountdown(countdown)}
                </p>
                <p className="text-xs text-gray-500">
                  {countdown === 0
                    ? '⚠️ El tiempo expiró — puede necesitar ayuda'
                    : `${session.initiator_name} tiene este tiempo para llegar`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Estado de mi sharing */}
        <div className={`rounded-xl border-2 p-4 ${sharing ? 'bg-white border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {sharing
              ? <UserCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
              : <UserX className="w-5 h-5 text-gray-400 flex-shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">Tu ubicación</p>
              <p className="text-xs text-gray-500">
                {sharing ? `Compartiéndola con ${session.initiator_name}` : 'No estás compartiendo'}
              </p>
            </div>
            {sharing && session.status === 'active' && (
              <button
                onClick={stopSharing}
                className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors"
              >
                Detener
              </button>
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <p className="font-medium text-gray-800 text-sm">Ubicaciones en tiempo real</p>
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                {session.initiator_name}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                Tú
              </span>
            </div>
          </div>
          {members.some(m => m.latitude) ? (
            <div ref={mapRef} style={{ height: '300px', width: '100%' }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Esperando ubicaciones...</p>
              </div>
            </div>
          )}
        </div>

        {/* Lista de participantes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <p className="font-medium text-gray-800 text-sm">Participantes ({members.length})</p>
          </div>
          <div className="divide-y divide-gray-100">
            {initiator && (
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                  {initiator.display_name[0].toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{initiator.display_name} <span className="text-xs text-gray-400">(organizador)</span></p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(initiator.updated_at)}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${initiator.is_sharing ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
            )}
            {otherMembers.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                  {m.display_name[0].toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{m.display_name}</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(m.updated_at)}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${m.is_sharing ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Abrir en Google Maps */}
        {initiator?.latitude && initiator?.longitude && (
          <a
            href={`https://maps.google.com/?q=${initiator.latitude},${initiator.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            🗺️ Ver a {session.initiator_name} en Google Maps
          </a>
        )}

        <p className="text-xs text-center text-gray-400 pb-4">
          SOSecure · Ubicación actualizada cada 30 segundos
        </p>
      </div>
    </div>
  )
}
