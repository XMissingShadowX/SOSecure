'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Shield, ShieldCheck, Clock, Users, Timer, AlertTriangle, Map, Navigation, ChevronDown, ChevronUp, Radio, UserCheck, UserX, RefreshCw, Mic, TriangleAlert, MapPinCheck, MapPinCheckInside, CircleAlert } from 'lucide-react'
import { RoutesTab, calculateSafetyScore } from './routes-tab'
import { MapTab } from './map-tab'
import { useAppStore } from '@/lib/store'
import { useTracking } from '@/hooks/use-tracking'
import { usePremium } from '@/hooks/use-premium'
import { useIncomingTracking } from '@/hooks/use-incoming-tracking'
import { useLiveLocation } from '@/hooks/use-live-location'
import { useContactUserIds } from '@/hooks/use-contact-user-ids'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { RouteInfo } from '@/components/route-map'
import type { TrackingMember } from '@/lib/types'

const RouteMap = dynamic(
  () => import('@/components/route-map').then(mod => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Cargando mapa...</span>
        </div>
      </div>
    ),
  }
)


const SAFE_ZONE_TYPES = [
  { type: 'pharmacy', label: '💊 Farmacia', color: 'text-green-400' },
  { type: 'police', label: '👮 Policía', color: 'text-blue-400' },
  { type: 'hospital', label: '🏥 Hospital', color: 'text-red-400' },
  { type: 'store', label: '🏪 Tienda', color: 'text-yellow-400' },
]

function formatCountdown(ms: number) {
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Sin actualizar'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 15) return 'Ahora mismo'
  if (diffSec < 60) return `Hace ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  return `Hace ${Math.floor(diffMin / 60)}h`
}

function memberStatus(m: TrackingMember): 'active' | 'stale' | 'stopped' {
  if (!m.is_sharing) return 'stopped'
  if (!m.updated_at) return 'stale'
  const diffMin = (Date.now() - new Date(m.updated_at).getTime()) / 60000
  return diffMin > 2 ? 'stale' : 'active'
}

function TrackingMap({ members, focusUserId }: { members: TrackingMember[], focusUserId?: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const LRef = useRef<any>(null)
  const initialFitDoneRef = useRef(false)
  // Cache of last known positions so we can pan even after a contact stops sharing
  const lastKnownRef = useRef<Record<string, [number, number]>>({})
  const [reloadKey, setReloadKey] = useState(0)

  const centerOnMe = useCallback(() => {
    if (!mapInstanceRef.current) return
    const me = members.find(m => m.is_initiator && m.latitude && m.longitude)
    if (!me) return
    mapInstanceRef.current.setView([me.latitude!, me.longitude!], 16, { animate: true })
  }, [members])

  // Reload button resets the initial-fit flag so next render re-fits
  const handleReload = useCallback(() => {
    initialFitDoneRef.current = false
    setReloadKey(k => k + 1)
  }, [])

  useEffect(() => {
    const withLocation = members.filter(m => m.latitude && m.longitude)
    if (!withLocation.length || !mapRef.current || typeof window === 'undefined') return

    const init = async () => {
      const L = (await import('leaflet')).default
      // @ts-ignore
      await import('leaflet/dist/leaflet.css')
      LRef.current = L

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current)
      }

      withLocation.forEach(m => {
        // Update last known position cache
        lastKnownRef.current[m.user_id ?? m.id] = [m.latitude!, m.longitude!]

        const color = m.is_initiator ? '#f97316' : '#3b82f6'
        const html = `<div style="width:20px;height:20px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px ${color}44,0 2px 6px rgba(0,0,0,0.2)"></div>`
        const icon = L.divIcon({ className: '', html, iconSize: [20, 20], iconAnchor: [10, 10] })
        if (markersRef.current[m.id]) {
          markersRef.current[m.id].setLatLng([m.latitude!, m.longitude!])
        } else {
          markersRef.current[m.id] = L.marker([m.latitude!, m.longitude!], { icon })
            .bindTooltip(m.display_name, { permanent: false, direction: 'top' })
            .addTo(mapInstanceRef.current)
        }
      })

      // Only fit bounds on first load or when reload button is pressed
      if (!initialFitDoneRef.current) {
        const bounds = L.latLngBounds(withLocation.map(m => [m.latitude!, m.longitude!] as [number, number]))
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
        initialFitDoneRef.current = true
      }
    }

    init()
  }, [members, reloadKey])

  // Pan to focused contact when focusUserId changes
  useEffect(() => {
    if (!focusUserId || !mapInstanceRef.current) return
    const pos = lastKnownRef.current[focusUserId]
    if (pos) {
      mapInstanceRef.current.setView(pos, 16, { animate: true })
    }
  }, [focusUserId])

  const hasLocation = members.some(m => m.latitude && m.longitude)
  const hasMe = members.some(m => m.is_initiator && m.latitude && m.longitude)

  return (
    <div className="rounded-lg overflow-hidden border border-border mt-3" style={{ isolation: 'isolate' }}>
      {hasLocation ? (
        <div className="relative">
          <div ref={mapRef} style={{ height: '320px', width: '100%' }} />
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-[999]">
            <button
              onClick={handleReload}
              className="w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors"
              title="Recargar mapa"
            >
              <RefreshCw className="w-4 h-4 text-gray-700" />
            </button>
            {hasMe && (
              <button
                onClick={centerOnMe}
                className="w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors"
                title="Centrar en mi ubicación"
              >
                <Navigation className="w-4 h-4 text-gray-700" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-36 flex items-center justify-center text-muted-foreground bg-muted/50">
          <p className="text-xs">Esperando ubicaciones…</p>
        </div>
      )}
    </div>
  )
}

export function BeforeTab() {
  const { isPremium } = usePremium()
  const {
    contacts, securityTimerActive, securityTimerEnd, setSecurityTimer, setSosActive,
    showRoutes, selectedRoute, routeOrigin, routeDestination, nearbyIncidents,
    setRouteOptions, setRouteInfo,
    sosActive, voiceKeyword, setVoiceKeyword,
    currentLocation: coordinates,
    simpleMode,
  } = useAppStore()
  const { session, members, loading: trackingLoading, error: trackingError, startTracking, stopTracking, syncTimer } = useTracking()

  const [countdown, setCountdown] = useState<number | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('30')
  const [showTimerDialog, setShowTimerDialog] = useState(false)
  const [routesExpanded, setRoutesExpanded] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [focusUserId, setFocusUserId] = useState<string | null>(null)
  const [showKeywordDialog, setShowKeywordDialog] = useState(false)
  const [keywordDraft, setKeywordDraft] = useState('')

  const { incoming, shareLocation, stopShare } = useIncomingTracking(currentUser?.id ?? null)
  const { contactUserIds, nameFor } = useContactUserIds(contacts)
  const { isSharingMyLocation, toggleSharing, contacts: liveContacts, myLocation } = useLiveLocation({
    currentUserId: currentUser?.id ?? null,
    currentUserName: currentUser?.name ?? null,
    contactUserIds,
  })

  // Cargar usuario actual
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser({
          id: user.id,
          name: user.user_metadata?.full_name || user.email || 'Usuario',
        })
      }
    })
  }, [])

  // Sincronizar el temporizador activo con la sesión de tracking
  useEffect(() => {
    if (!session) return
    syncTimer(securityTimerActive ? (securityTimerEnd ?? null) : null)
  }, [securityTimerActive, securityTimerEnd, session, syncTimer])
  
  useEffect(() => {
    if (!securityTimerActive || !securityTimerEnd) {
      setCountdown(null)
      return
    }
    const tick = () => {
      const remaining = securityTimerEnd - Date.now()
      if (remaining <= 0) {
        setCountdown(0)
        playAlarmSound()
        sendAlarmNotification('⏰ Temporizador de seguridad expirado', 'No se recibió confirmación de llegada — activando alerta', true)
        setSosActive(true)
        setSecurityTimer(false, null)
      } else {
        setCountdown(remaining)
        if (remaining < 5 * 60 * 1000 && remaining > 4.9 * 60 * 1000) {
          sendAlarmNotification('⏰ SOSecure', 'Quedan 5 minutos en tu temporizador de seguridad')
        }
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [securityTimerActive, securityTimerEnd, setSosActive, setSecurityTimer])

  const startTimer = useCallback(() => {
    const mins = parseInt(timerMinutes) || 30
    const endTime = Date.now() + mins * 60 * 1000
    setSecurityTimer(true, endTime)
    setShowTimerDialog(false)
    sendAlarmNotification('⏱️ Temporizador iniciado', `Tienes ${mins} minutos para llegar a tu destino`)
  }, [timerMinutes, setSecurityTimer])

  const cancelTimer = useCallback(() => {
    setSecurityTimer(false, null)
    setCountdown(null)
    sendAlarmNotification('✅ Temporizador cancelado', 'Llegaste con seguridad')
  }, [setSecurityTimer])

  return (
    <div className="flex flex-col gap-6 pb-60">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-center gap-3 py-2 px-3">
          <TriangleAlert className="w-5 h-5 shrink-0 text-primary" />
          <div className="text-center">
            <p className="font-semibold text-base">Modo ANTES</p>
            <p className="text-sm text-muted-foreground">Prepárate antes de salir</p>
          </div>
        </CardContent>
      </Card>

      {/* Mapa compartido — se muestra debajo de rutas si el mapa está colapsado, o en su propia sección si está expandido */}
      {(() => {
        const sharedMap = (
          <MapTab
            embedded
            customMap={showRoutes && routeOrigin && routeDestination ? (
              <RouteMap
                origin={routeOrigin}
                destination={routeDestination}
                selectedRoute={selectedRoute}
                incidents={nearbyIncidents}
                onRoutesLoaded={(routes: RouteInfo[]) => {
                  const info: Record<string, { distance: string; duration: string }> = {}
                  routes.forEach(r => { info[r.id] = { distance: r.distance, duration: r.duration } })
                  setRouteInfo(info)
                  const safetyScore = calculateSafetyScore(routeDestination, nearbyIncidents)
                  const names: Record<string, string> = {
                    safest: 'Ruta más Segura',
                    fastest: 'Ruta más Rápida',
                    alternate: 'Ruta Alternativa',
                  }
                  setRouteOptions(routes.map((r, i) => ({
                    id: r.id,
                    name: names[r.id] || `Ruta ${i + 1}`,
                    distance: r.distance,
                    duration: r.duration,
                    safetyScore: {
                      score: Math.max(0, Math.min(100, safetyScore.score - i * 10)),
                      incidents_nearby: Math.max(0, safetyScore.incidents_nearby - (routes.length - 1 - i)),
                      risk_level: (safetyScore.score - i * 10) < 50 ? 'danger' : (safetyScore.score - i * 10) < 75 ? 'caution' : 'safe',
                    },
                    incidentsOnRoute: Math.max(0, safetyScore.incidents_nearby - (routes.length - 1 - i)),
                  })))
                }}
              />
            ) : undefined}
          />
        )
        return (
          <>
            {/* Planificación de rutas — oculta en Modo Simple (usar tab Rutas) */}
            {!simpleMode && (
              <div>
                <button
                  onClick={() => setRoutesExpanded(v => !v)}
                  className="w-full flex items-center justify-between text-base font-semibold mb-3"
                >
                  <span className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-primary" />
                    Planear Ruta Segura
                  </span>
                  {routesExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {routesExpanded && <RoutesTab hideMap />}
                {routesExpanded && !mapExpanded && (
                  <div className="mt-3">{sharedMap}</div>
                )}
              </div>
            )}

            {/* Sección de mapa independiente — oculta en Modo Simple */}
            {!simpleMode && (
              <div>
                <button
                  onClick={() => setMapExpanded(v => !v)}
                  className="w-full flex items-center justify-between text-base font-semibold mb-2"
                >
                  <span className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-primary" />
                    {showRoutes && routeDestination ? 'Mapa de Ruta + Incidentes' : 'Mapa de Incidentes'}
                  </span>
                  {mapExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {mapExpanded && sharedMap}
              </div>
            )}
          </>
        )
      })()}

      {/* Temporizador de Seguridad */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="w-5 h-5 text-primary" />
            Temporizador de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityTimerActive && countdown !== null ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-5xl font-mono font-bold ${countdown < 5 * 60 * 1000 ? 'text-destructive' : 'text-safe'}`}>
                  {formatCountdown(countdown)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Tiempo restante para llegar</p>
              </div>
              <div className={`p-3 rounded-lg ${countdown < 5 * 60 * 1000 ? 'bg-destructive/10' : 'bg-safe/10'}`}>
                <p className="text-xs text-center text-muted-foreground">
                  Si el tiempo expira sin confirmación, se activará una alerta automática
                </p>
              </div>
              <Button className="w-full" variant="outline" onClick={cancelTimer}>
                ✅ Llegué con seguridad
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Activa un temporizador. Si no confirmas tu llegada, se alertará a tus contactos automáticamente.
              </p>
              <Dialog open={showTimerDialog} onOpenChange={setShowTimerDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Clock className="w-4 h-4 mr-2" />
                    Iniciar Temporizador
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Temporizador de Seguridad</DialogTitle>
                    <DialogDescription>
                      ¿Cuántos minutos tienes para llegar a tu destino?
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Minutos</FieldLabel>
                      <Input
                        type="number"
                        min="1"
                        max="240"
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(e.target.value)}
                        placeholder="30"
                      />
                    </Field>
                    <div className="flex gap-2 flex-wrap">
                      {(simpleMode ? [15, 30, 60] : [5, 10, 15, 30, 60]).map(m => (
                        <button key={m} onClick={() => setTimerMinutes(m.toString())}
                          className={`px-3 py-1.5 rounded-md text-sm ${timerMinutes === m.toString() ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTimerDialog(false)}>Cancelar</Button>
                    <Button onClick={startTimer}>Iniciar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      {/* Zonas Seguras */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinCheckInside className="w-5 h-5 text-safe" />
            Zonas Seguras Cercanas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Locales donde puedes refugiarte en caso de emergencia:
          </p>
          {coordinates ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '💊 Farmacia', query: 'farmacia' },
                { label: '👮 Policía', query: 'ministerio+publico' },
                { label: '🏥 Hospital', query: 'hospital' },
                { label: '🏪 Tienda 24h', query: 'tienda+24+horas' },
              ].map((z) => (
                <button
                  key={z.query}
                  onClick={() => window.open(`https://www.google.com/maps/search/${z.query}/@${coordinates.latitude},${coordinates.longitude},15z`, '_blank')}
                  className="p-3 bg-muted/50 rounded-lg flex items-center gap-2 hover:bg-muted transition-colors text-left w-full"
                >
                  <span className="text-lg">{z.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{z.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">Ver en mapa</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {SAFE_ZONE_TYPES.map((z) => (
                <div key={z.type} className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                  <span className="text-lg">{z.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-xs font-medium">{z.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">Activa ubicación</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seguimiento en Vivo — modelo Life360, solo premium */}
      {isPremium && <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Ubicaciones en Vivo
            {isSharingMyLocation && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-600">
                <Radio className="w-3 h-3 animate-pulse" />
                Compartiendo
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Agrega contactos con cuenta SOSecure para ver sus ubicaciones</p>
            </div>
          ) : (
            <>
              {/* Toggle de sharing propio */}
              <button
                onClick={toggleSharing}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors
                  ${isSharingMyLocation
                    ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                    : 'border-border bg-muted/30 hover:bg-muted/60'}`}
              >
                {isSharingMyLocation
                  ? <UserCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                  : <UserX className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                <div className="text-left flex-1">
                  <p className={`text-sm font-medium ${isSharingMyLocation ? 'text-green-700 dark:text-green-400' : ''}`}>
                    {isSharingMyLocation ? 'Compartiendo mi ubicación' : 'Compartir mi ubicación'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSharingMyLocation ? 'Tus contactos SOSecure pueden verte · Toca para detener' : 'Tus contactos no pueden verte ahora'}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5
                  ${isSharingMyLocation ? 'bg-green-500 justify-end' : 'bg-muted-foreground/30 justify-start'}`}>
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </div>
              </button>

              {/* Lista de contactos con su estado */}
              <div className="space-y-2">
                {contactUserIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    Ningún contacto tiene cuenta SOSecure aún
                  </p>
                ) : (
                  contactUserIds.map(uid => {
                    const live = liveContacts.find(c => c.user_id === uid)
                    const name = nameFor(uid)
                    const diffMin = live ? (Date.now() - new Date(live.updated_at).getTime()) / 60000 : Infinity
                    const status = live ? (diffMin > 3 ? 'stale' : 'active') : 'offline'
                    const isFocused = focusUserId === uid
                    return (
                      <button
                        key={uid}
                        onClick={() => setFocusUserId(isFocused ? null : uid)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left
                          ${isFocused ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-muted/50 hover:bg-muted/80'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {live ? formatRelativeTime(live.updated_at) : 'No está compartiendo'}
                          </p>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          status === 'active' ? 'bg-green-400' :
                          status === 'stale' ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                      </button>
                    )
                  })
                )}
              </div>

              {/* Mapa unificado */}
              {(isSharingMyLocation || liveContacts.length > 0) && (() => {
                const mapMembers = [
                  ...(myLocation && isSharingMyLocation ? [{
                    id: currentUser?.id ?? 'me',
                    session_id: '',
                    display_name: currentUser?.name ?? 'Tú',
                    is_initiator: true,
                    external_token: '',
                    user_id: currentUser?.id ?? null,
                    latitude: myLocation.latitude,
                    longitude: myLocation.longitude,
                    updated_at: new Date().toISOString(),
                    is_sharing: true,
                  }] : []),
                  ...liveContacts.map(c => ({
                    id: c.user_id,
                    session_id: '',
                    display_name: nameFor(c.user_id),
                    is_initiator: false,
                    external_token: '',
                    user_id: c.user_id,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    updated_at: c.updated_at,
                    is_sharing: true,
                  })),
                ]
                return <TrackingMap members={mapMembers} focusUserId={focusUserId} />
              })()}

              <p className="text-xs text-muted-foreground text-center">
                Solo contactos con cuenta SOSecure · Actualiza cada 30s
              </p>
            </>
          )}
        </CardContent>
      </Card>}

      {/* Palabra Clave de Voz — oculta en Modo Simple */}
      {!simpleMode && <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="w-5 h-5 text-primary" />
            Palabra Clave de Voz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Di esta palabra en voz alta para activar el SOS automáticamente (solo funciona cuando el SOS no está activo).
          </p>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Palabra actual</p>
              <p className="font-semibold text-sm">{voiceKeyword || 'No configurada'}</p>
            </div>
            {sosActive ? (
              <span className="text-xs text-muted-foreground">SOS activo</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Mic className="w-3 h-3 animate-pulse" />
                Escuchando
              </span>
            )}
          </div>
          <Dialog open={showKeywordDialog} onOpenChange={(open) => {
            setShowKeywordDialog(open)
            if (open) setKeywordDraft(voiceKeyword)
          }}>
            <Button className="w-full" variant="outline" onClick={() => {
              setKeywordDraft(voiceKeyword)
              setShowKeywordDialog(true)
            }}>
              Cambiar palabra clave
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Palabra Clave de Voz</DialogTitle>
                <DialogDescription>
                  Elige una palabra única que activa el SOS cuando la dices en voz alta.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>Palabra clave</FieldLabel>
                  <Input
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    placeholder="ej. socorro"
                    autoFocus
                  />
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowKeywordDialog(false)}>Cancelar</Button>
                <Button
                  disabled={!keywordDraft.trim()}
                  onClick={() => {
                    setVoiceKeyword(keywordDraft.trim().toLowerCase())
                    setShowKeywordDialog(false)
                  }}
                >
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>}

      {/* Contactos listos para alertar */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleAlert className="w-5 h-5 text-warning" />
            Contactos listos para alertar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Agrega contactos desde la pestaña Inicio</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-sm !text-black dark:!text-white">
                  {c.name} · {c.importance === 'primary' ? '🔴' : c.importance === 'secondary' ? '🟡' : '🔵'}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
