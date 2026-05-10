'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Coordinates, Incident } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const originIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#4ade80;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const destinationIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

interface RouteGeometry {
  id: string
  coordinates: [number, number][]
  color: string
  selected: boolean
  distance: string
  duration: string
}

export interface RouteInfo {
  id: string
  distance: string
  duration: string
}

interface MapFitterProps {
  origin: Coordinates
  destination: Coordinates
}

function MapFitter({ origin, destination }: MapFitterProps) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds(
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude]
    )
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, origin, destination])
  return null
}

interface RouteMapProps {
  origin: Coordinates
  destination: Coordinates
  selectedRoute: string | null
  incidents: Incident[]
  onRoutesLoaded?: (routes: RouteInfo[]) => void
}

export function RouteMap({ origin, destination, selectedRoute, incidents, onRoutesLoaded }: RouteMapProps) {
  const [routes, setRoutes] = useState<RouteGeometry[]>([])
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return document.documentElement.className === 'dark'
  })

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.className === 'dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!origin || !destination) return
    const url = `https://router.project-osrm.org/route/v1/foot/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&alternatives=true`
    fetch(url)
      .then(r => r.json())
      .then((data) => {
        if (data.code !== 'Ok') return
        const colors = ['#4ade80', '#3b82f6', '#f59e0b']
        const ids = ['safest', 'fastest', 'alternate']
        const parsed: RouteGeometry[] = data.routes.map((r: any, i: number) => ({
          id: ids[i] || `route-${i}`,
          coordinates: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
          color: colors[i] || '#888',
          selected: ids[i] === selectedRoute,
          distance: r.distance >= 1000
            ? `${(r.distance / 1000).toFixed(1)} km`
            : `${Math.round(r.distance)} m`,
          duration: r.duration >= 3600
            ? `${Math.floor(r.duration / 3600)}h ${Math.floor((r.duration % 3600) / 60)} min`
            : `${Math.floor(r.duration / 60)} min`,
        }))
        setRoutes(parsed)
        onRoutesLoaded?.(parsed.map(r => ({
          id: r.id,
          distance: r.distance,
          duration: r.duration,
        })))
      })
  }, [origin, destination])

  useEffect(() => {
    setRoutes(prev => prev.map(r => ({ ...r, selected: r.id === selectedRoute })))
  }, [selectedRoute])

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

  return (
    <MapContainer
      center={[origin.latitude, origin.longitude]}
      zoom={14}
      className="h-full w-full rounded-lg"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer key={isDark ? 'dark' : 'light'} url={tileUrl} attribution='&copy; OpenStreetMap' />
      <MapFitter origin={origin} destination={destination} />

      {routes.map(route => (
        <Polyline
          key={route.id}
          positions={route.coordinates}
          pathOptions={{
            color: route.color,
            weight: route.selected ? 5 : 3,
            opacity: route.selected ? 1 : 0.4,
          }}
        />
      ))}

      <Marker position={[origin.latitude, origin.longitude]} icon={originIcon} />
      <Marker position={[destination.latitude, destination.longitude]} icon={destinationIcon} />
    </MapContainer>
  )
}