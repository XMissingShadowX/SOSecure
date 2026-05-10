'use client'

import { useState, useEffect} from 'react'
import dynamic from 'next/dynamic'
import { Navigation, MapPin, AlertTriangle, Clock, Shield, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Coordinates, SafetyScore } from '@/lib/types'
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
    )
  }
)

interface RouteOption {
  id: string
  name: string
  distance: string
  duration: string
  safetyScore: SafetyScore
  incidentsOnRoute: number
}

function calculateSafetyScore(
  destination: Coordinates,
  incidents: { latitude: number; longitude: number; severity: string }[]
): SafetyScore {
  const nearbyIncidents = incidents.filter(inc => {
    const latDiff = Math.abs(inc.latitude - destination.latitude)
    const lngDiff = Math.abs(inc.longitude - destination.longitude)
    return latDiff < 0.01 && lngDiff < 0.01
  })
  const highSeverity = nearbyIncidents.filter(i => i.severity === 'high').length
  const mediumSeverity = nearbyIncidents.filter(i => i.severity === 'medium').length
  const lowSeverity = nearbyIncidents.filter(i => i.severity === 'low').length
  let score = 100
  score -= highSeverity * 25
  score -= mediumSeverity * 10
  score -= lowSeverity * 5
  score = Math.max(0, Math.min(100, score))
  let riskLevel: 'safe' | 'caution' | 'danger' = 'safe'
  if (score < 50) riskLevel = 'danger'
  else if (score < 75) riskLevel = 'caution'
  return { score, incidents_nearby: nearbyIncidents.length, risk_level: riskLevel }
}

export function RoutesTab() {
  const { coordinates } = useGeolocation({ watch: true })
  const { nearbyIncidents, routeOrigin, routeDestination, setRouteOrigin, setRouteDestination, currentLocation, frequentPlaces } = useAppStore()
  const [destinationInput, setDestinationInput] = useState('')
  const [showRoutes, setShowRoutes] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [routeInfo, setRouteInfo] = useState<Record<string, { distance: string; duration: string }>>({})
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])

  useEffect(() => {
    if (coordinates && !routeOrigin) {
      setRouteOrigin(coordinates)
    }
  }, [coordinates, routeOrigin, setRouteOrigin])        

  const handleSearch = async () => {
    if (!destinationInput || !coordinates) return
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(destinationInput)}&limit=1`,
        { headers: { 'Accept': 'application/json' } }
      )
      const data = await res.json()
      if (!data.features?.length) { alert('No se encontró la dirección.'); return }
      const f = data.features[0]
      setRouteDestination({
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
      })
      setShowRoutes(true)
      setSelectedRoute('safest')
    } catch {
      alert('Error al buscar la dirección.')
    }
  }

  const handleQuickSelect = async (location: typeof frequentPlaces[0]) => {
    setDestinationInput(location.label)
    if (location.coordinates) {
      setRouteDestination(location.coordinates)
      setShowRoutes(true)
      setSelectedRoute('safest')
    }
  }

  const resetRoute = () => {
    setDestinationInput('')
    setRouteDestination(null)
    setShowRoutes(false)
    setSelectedRoute(null)
    setRouteInfo({})
    setSuggestions([])
  }

  const getSafetyColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'text-safe'
      case 'caution': return 'text-warning'
      case 'danger': return 'text-destructive'
      default: return 'text-muted-foreground'
    }
  }

  const getSafetyBg = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'bg-safe/10 border-safe'
      case 'caution': return 'bg-warning/10 border-warning'
      case 'danger': return 'bg-destructive/10 border-destructive'
      default: return 'bg-muted'
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-40">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Navigation className="w-5 h-5 text-primary" />
            Planear Ruta Segura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-safe" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Desde</p>
              <p className="text-sm font-medium">
                {coordinates ? 'Ubicación actual' : 'Esperando ubicación...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <div className="flex-1 relative">
              <Input
                placeholder="¿A dónde vas?"
                value={destinationInput}
                onChange={async (e) => {
                  const value = e.target.value
                  setDestinationInput(value)
                  if (value.length < 3) { setSuggestions([]); return }
                  clearTimeout((window as any)._nominatimTimeout)
                  ;(window as any)._nominatimTimeout = setTimeout(async () => {
                    setSearching(true)
                    try {
                      const res = await fetch(
                        `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`,
                        { headers: { 'Accept': 'application/json' } }
                      )
                      const data = await res.json()
                      setSuggestions(data.features.map((f: any) => ({
                        display_name: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', '),
                        lat: f.geometry.coordinates[1].toString(),
                        lon: f.geometry.coordinates[0].toString(),
                      })))
                    } catch {}
                    setSearching(false)
                  }, 500)
                }}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-6 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {searching && <p className="text-xs text-muted-foreground p-2">Buscando...</p>}
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
                      onClick={() => {
                        setDestinationInput(s.display_name)
                        setRouteDestination({ latitude: parseFloat(s.lat), longitude: parseFloat(s.lon) })
                        setShowRoutes(true)
                        setSelectedRoute('safest')
                        setSuggestions([])
                      }}
                    >
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {frequentPlaces.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {frequentPlaces.map((place) => (
                <Button key={place.id} variant="outline" size="sm" onClick={() => handleQuickSelect(place)}>
                  <MapPin className="w-3 h-3 mr-1" />
                  {place.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Agrega lugares frecuentes en Inicio para acceso rápido aquí
            </p>
          )}

          <div className="flex gap-2">
            {showRoutes ? (
              <Button variant="outline" onClick={resetRoute} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reiniciar
              </Button>
            ) : (
              <Button onClick={handleSearch} className="flex-1" disabled={!destinationInput || !coordinates}>
                Planear Ruta Segura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showRoutes && routeOrigin && routeDestination && (
        <div className="h-64 rounded-lg overflow-hidden relative z-0">
          <RouteMap
            origin={routeOrigin}
            destination={routeDestination}
            selectedRoute={selectedRoute}
            incidents={nearbyIncidents}
            onRoutesLoaded={(routes: RouteInfo[]) => {
              const info: Record<string, { distance: string; duration: string }> = {}
              routes.forEach(r => { info[r.id] = { distance: r.distance, duration: r.duration } })
              setRouteInfo(info)

              const names: Record<string, string> = {
                safest: 'Ruta más Segura',
                fastest: 'Ruta más Rápida',
                alternate: 'Ruta Alternativa',
              }

              const safetyScore = routeDestination
                ? calculateSafetyScore(routeDestination, nearbyIncidents)
                : { score: 100, incidents_nearby: 0, risk_level: 'safe' as const }

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
        </div>
      )}

      {showRoutes && routeOptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Opciones de Ruta</h3>
          {routeOptions.map((route) => (
            <Card
              key={route.id}
              className={cn(
                "cursor-pointer transition-all border-2",
                selectedRoute === route.id
                  ? getSafetyBg(route.safetyScore.risk_level)
                  : "border-transparent hover:border-border"
              )}
              onClick={() => setSelectedRoute(route.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {route.name}
                      {route.id === 'safest' && <Shield className="w-4 h-4 text-safe" />}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span>{routeInfo[route.id]?.distance || route.distance}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {routeInfo[route.id]?.duration || route.duration}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-2xl font-bold", getSafetyColor(route.safetyScore.risk_level))}>
                      {route.safetyScore.score}
                    </div>
                    <p className="text-xs text-muted-foreground">Puntuación de Seguridad</p>
                  </div>
                </div>
                {route.incidentsOnRoute > 0 && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{route.incidentsOnRoute} incidente{route.incidentsOnRoute > 1 ? 's' : ''} cerca de la ruta</span>
                  </div>
                )}
                {route.safetyScore.risk_level === 'safe' && route.incidentsOnRoute === 0 && (
                  <div className="flex items-center gap-2 text-sm text-safe">
                    <Shield className="w-4 h-4" />
                    <span>Sin incidentes reportados en esta ruta</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showRoutes && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Consejos de Seguridad en Ruta
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-safe mt-2 flex-shrink-0" />
                Elige rutas con mayor puntuación de seguridad cuando sea posible
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                Evita zonas con incidentes recientes de alta severidad
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                Las calles principales bien iluminadas son más seguras de noche
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}