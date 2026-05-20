/*
  Este código define el componente `RoutesTab`, que es una interfaz para planear rutas seguras utilizando la ubicación 
  actual del usuario y un destino ingresado. El componente utiliza la geolocalización para obtener la ubicación del 
  usuario, permite buscar destinos utilizando la API de Photon, muestra sugerencias de autocompletado, y luego muestra 
  un mapa con diferentes opciones de ruta junto con una puntuación de seguridad basada en incidentes cercanos. También 
  proporciona consejos de seguridad para los usuarios al planear sus rutas.
*/

'use client'

// Importar dependencias y componentes necesarios para el funcionamiento de la pestaña de rutas. Esto incluye hooks 
// de React para manejar el estado y los efectos, componentes dinámicos para cargar el mapa sin renderizado del 
// lado del servidor, iconos de la biblioteca Lucide, funciones de utilidad, hooks personalizados para geolocalización, 
// componentes de la interfaz de usuario como botones, tarjetas e inputs, y tipos para coordenadas, puntuaciones de 
// seguridad e información de rutas.
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

// Cargar el componente `RouteMap` de forma dinámica para evitar problemas de renderizado del lado del servidor, ya que 
// el mapa depende de la geolocalización y otras APIs del navegador. Mientras se carga el componente, se muestra un 
// indicador de carga con un mensaje "Cargando mapa...".
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

// Definir la interfaz `RouteOption`, que representa una opción de ruta que se muestra al usuario. Cada opción de ruta
// tiene un identificador único, un nombre descriptivo, información sobre la distancia y duración de la ruta, una 
// puntuación de seguridad que incluye el puntaje numérico, el número de incidentes cercanos y el nivel de riesgo, 
// y el número de incidentes que se encuentran directamente en la ruta.
interface RouteOption {
  id: string
  name: string
  distance: string
  duration: string
  safetyScore: SafetyScore
  incidentsOnRoute: number
}

// Función para calcular la puntuación de seguridad de una ruta basada en la ubicación del destino y los incidentes reportados
// cercanos. La función filtra los incidentes que están dentro de un rango de latitud y longitud del destino, y luego 
// calcula una puntuación de seguridad basada en la cantidad y severidad de los incidentes cercanos. La puntuación se 
// ajusta para estar entre 0 y 100, y se asigna un nivel de riesgo basado en la puntuación (seguro, precaución o peligro).
function calculateSafetyScore(
  destination: Coordinates,
  incidents: { latitude: number; longitude: number; severity: string }[]
): SafetyScore {
  // Filtrar los incidentes que están cerca del destino utilizando un rango de latitud y longitud. En este caso, 
  // se considera que un incidente está cerca si su latitud y longitud están dentro de 0.01 grados del destino, 
  // lo que equivale a aproximadamente 1 km. Esto ayuda a identificar los incidentes que podrían afectar la seguridad 
  // de la ruta hacia el destino.
  const nearbyIncidents = incidents.filter(inc => {
    const latDiff = Math.abs(inc.latitude - destination.latitude)
    const lngDiff = Math.abs(inc.longitude - destination.longitude)
    return latDiff < 0.01 && lngDiff < 0.01
  })

  // Contar la cantidad de incidentes cercanos por nivel de severidad (alto, medio, bajo) para calcular el impacto en la
  // puntuación de seguridad. Cada nivel de severidad tiene un peso diferente que afecta la puntuación final, con los 
  // incidentes de alta severidad teniendo el mayor impacto negativo en la puntuación.
  const highSeverity = nearbyIncidents.filter(i => i.severity === 'high').length
  const mediumSeverity = nearbyIncidents.filter(i => i.severity === 'medium').length
  const lowSeverity = nearbyIncidents.filter(i => i.severity === 'low').length
  
  // Calcular la puntuación de seguridad inicial en 100 y restar puntos según la cantidad y severidad de los incidentes 
  // cercanos.
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

// Definir el componente `RoutesTab`, que es la interfaz principal para planear rutas seguras. El componente maneja el estado de
// la ubicación del usuario, el destino ingresado, las opciones de ruta disponibles, y la puntuación de seguridad. Proporciona 
// funciones para buscar destinos utilizando la API de Photon, seleccionar rutas, y mostrar información relevante sobre la 
// seguridad de cada ruta. También muestra consejos de seguridad para los usuarios al planear sus rutas.
export function RoutesTab() {
  // Utilizar el hook `useGeolocation` para obtener las coordenadas de la ubicación actual del usuario, y el hook `useAppStore`
  // para acceder a los incidentes cercanos, el origen y destino de la ruta, la ubicación actual y los lugares frecuentes. 
  // El componente también maneja varios estados locales para el input del destino, la visualización de las rutas, la ruta 
  // seleccionada, las sugerencias de autocompletado, el estado de búsqueda, la información de las rutas y las opciones de ruta.
  const { coordinates } = useGeolocation({ watch: true })
  const { nearbyIncidents, routeOrigin, routeDestination, setRouteOrigin, setRouteDestination, currentLocation, frequentPlaces } = useAppStore()
  const [destinationInput, setDestinationInput] = useState('')
  const [showRoutes, setShowRoutes] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [routeInfo, setRouteInfo] = useState<Record<string, { distance: string; duration: string }>>({})
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])

  // Efecto para establecer el origen de la ruta como la ubicación actual del usuario tan pronto como se obtienen 
  // las coordenadas. Esto asegura que el punto de partida de la ruta sea siempre la ubicación actual, a menos 
  // que el usuario decida cambiarlo manualmente. El efecto depende de las coordenadas, el origen de la ruta y 
  // la función para establecer el origen, y solo se ejecuta si las coordenadas están disponibles y el origen de 
  // la ruta aún no ha sido establecido.
  useEffect(() => {
    if (coordinates && !routeOrigin) {
      setRouteOrigin(coordinates)
    }
  }, [coordinates, routeOrigin, setRouteOrigin])        

  // Función para manejar la búsqueda del destino ingresado por el usuario. La función verifica que el input del destino
  // no esté vacío y que las coordenadas de la ubicación actual estén disponibles. Luego, realiza una solicitud a la API de 
  // Photon para buscar el destino ingresado, y si se encuentra una coincidencia, establece el destino de la ruta con las 
  // coordenadas del resultado y muestra las opciones de ruta. Si no se encuentra el destino o si ocurre un error durante 
  // la búsqueda, se muestra una alerta al usuario.
  const handleSearch = async () => {
    if (!destinationInput || !coordinates) return
    // Realizar una solicitud a la API de Photon para buscar el destino ingresado por el usuario. La función codifica el
    // input del destino para asegurarse de que sea seguro para usar en una URL, y limita los resultados a 1 para obtener la 
    // coincidencia más relevante. Si se encuentra una coincidencia, se extraen las coordenadas del resultado y se establece 
    // el destino de la ruta. Si no se encuentra el destino o si ocurre un error durante la búsqueda, se muestra una alerta al usuario.
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

  // Función para manejar la selección rápida de un lugar frecuente. Cuando el usuario hace clic en uno de los lugares frecuentes,
  // esta función se ejecuta para establecer el input del destino con la etiqueta del lugar seleccionado, y si el lugar tiene 
  // coordenadas asociadas, también establece el destino de la ruta con esas coordenadas, muestra las opciones de ruta y selecciona
  // automáticamente la ruta más segura. Esto proporciona una forma rápida y conveniente para que los usuarios seleccionen destinos 
  // comunes sin tener que escribir manualmente la dirección.
  const handleQuickSelect = async (location: typeof frequentPlaces[0]) => {
    setDestinationInput(location.label)
    if (location.coordinates) {
      setRouteDestination(location.coordinates)
      setShowRoutes(true)
      setSelectedRoute('safest')
    }
  }

  // Función para reiniciar la planificación de la ruta. Esta función limpia el input del destino, restablece el destino 
  // de la ruta a null, oculta las opciones de ruta, deselecciona cualquier ruta seleccionada, limpia la información de 
  // las rutas y borra las sugerencias de autocompletado. Esto permite al usuario comenzar de nuevo el proceso de 
  // planificación de la ruta sin tener que recargar la página o perder la ubicación actual.
  const resetRoute = () => {
    setDestinationInput('')
    setRouteDestination(null)
    setShowRoutes(false)
    setSelectedRoute(null)
    setRouteInfo({})
    setSuggestions([])
  }

  // Función para obtener la clase de color de texto basada en el nivel de riesgo. Esta función se utiliza para asignar un color
  // específico a la puntuación de seguridad de cada ruta, lo que ayuda a los usuarios a identificar visualmente qué rutas son más seguras (verde), 
  // cuáles requieren precaución (amarillo) y cuáles son más peligrosas (rojo). Si el nivel de riesgo no coincide con ninguno de los casos definidos, 
  // se devuelve un color de texto neutro.
  const getSafetyColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'text-safe'
      case 'caution': return 'text-warning'
      case 'danger': return 'text-destructive'
      default: return 'text-muted-foreground'
    }
  }

  // Función para obtener la clase de fondo y borde basada en el nivel de riesgo. Esta función se utiliza para asignar 
  // un estilo de fondo y borde a las tarjetas de ruta seleccionadas, lo que proporciona una indicación visual adicional 
  // del nivel de seguridad de la ruta. Las rutas más seguras tendrán un fondo verde claro y un borde verde, las rutas 
  // que requieren precaución tendrán un fondo amarillo claro y un borde amarillo, y las rutas más peligrosas tendrán
  // un fondo rojo claro y un borde rojo. Si el nivel de riesgo no coincide con ninguno de los casos definidos, se 
  // devuelve un estilo de fondo neutro.
  const getSafetyBg = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'bg-safe/10 border-safe'
      case 'caution': return 'bg-warning/10 border-warning'
      case 'danger': return 'bg-destructive/10 border-destructive'
      default: return 'bg-muted'
    }
  }

  // Renderizar la interfaz de la pestaña de rutas, que incluye un formulario para ingresar el destino, sugerencias de 
  // autocompletado, opciones de lugares frecuentes para selección rápida, un botón para planear la ruta segura, y 
  // un mapa que muestra las rutas disponibles junto con su puntuación de seguridad. Si no se han mostrado las rutas, 
  // también se muestran consejos de seguridad para los usuarios.
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
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted-foreground border-b border-border last:border-0"
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