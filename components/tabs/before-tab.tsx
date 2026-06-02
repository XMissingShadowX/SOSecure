'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { ShieldCheck, Clock, Users, Timer, AlertTriangle, Map, Navigation, ChevronDown, ChevronUp } from 'lucide-react'
import { RoutesTab, calculateSafetyScore } from './routes-tab'
import { MapTab } from './map-tab'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
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

export function BeforeTab() {
  const {
    contacts, securityTimerActive, securityTimerEnd, setSecurityTimer, setSosActive,
    showRoutes, selectedRoute, routeOrigin, routeDestination, nearbyIncidents,
    setRouteOptions, setRouteInfo,
  } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })

  const [countdown, setCountdown] = useState<number | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('30')
  const [showTimerDialog, setShowTimerDialog] = useState(false)
  const [trackedUsers] = useState<{ name: string; status: string }[]>([])
  const [routesExpanded, setRoutesExpanded] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
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
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold text-sm">Modo ANTES</p>
            <p className="text-xs text-muted-foreground">Prepárate antes de salir</p>
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
            {/* Planificación de rutas */}
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
              {/* Mapa aquí solo cuando la sección de mapa está colapsada */}
              {routesExpanded && !mapExpanded && (
                <div className="mt-3">{sharedMap}</div>
              )}
            </div>

            {/* Sección de mapa independiente */}
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
          </>
        )
      })()}

      {/* Temporizador de Seguridad */}
      <Card>
        <CardHeader className="pb-3">
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
                      {[5, 10, 15, 30, 60].map(m => (
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-safe" />
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

      {/* Seguimiento a Contactos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Seguimiento a Contactos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trackedUsers.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay usuarios compartiéndote su ubicación</p>
              <p className="text-xs text-muted-foreground mt-1">Pídeles a tus contactos que habiliten el seguimiento</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trackedUsers.map((u, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            El seguimiento requiere que el contacto acepte compartir su ubicación
          </p>
        </CardContent>
      </Card>

      {/* Contactos listos para alertar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-warning" />
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
