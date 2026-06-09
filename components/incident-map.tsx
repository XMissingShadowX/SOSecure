'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { useAppStore } from '@/lib/store'
import type { Incident, Coordinates } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const createIcon = (color: string) => new L.DivIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
})

const userIcon = new L.DivIcon({
  className: 'user-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #4ade80;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.3), 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
})

const severityColors: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
}

const incidentTypeLabels: Record<string, string> = {
  'theft-assault-violence': 'Robo / Asalto / Violencia',
  'harassment-suspicious': 'Acoso / Sospechoso',
  accident: 'Accidente',
  SOS: 'SOS',
}

interface MapUpdaterProps {
  center: Coordinates
  zoom: number
}

function MapUpdater({ center, zoom }: MapUpdaterProps) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

interface FlyToControllerProps {
  trigger: number
  userLocation: Coordinates | null
}

function FlyToController({ trigger, userLocation }: FlyToControllerProps) {
  const map = useMap()
  const prevTrigger = useRef(0)

  useEffect(() => {
    if (trigger > prevTrigger.current && userLocation) {
      map.flyTo([userLocation.latitude, userLocation.longitude], 16, { duration: 1.2 })
      prevTrigger.current = trigger
    }
  }, [trigger, userLocation, map])

  return null
}

const severityIntensity: Record<string, number> = {
  high: 1.0,
  medium: 0.55,
  low: 0.25,
}

interface HeatLayerProps {
  incidents: Incident[]
}

function HeatLayer({ incidents }: HeatLayerProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [map])

  useEffect(() => {
    if (!incidents.length) return

    const points = incidents.map(inc => [
      inc.latitude,
      inc.longitude,
      severityIntensity[inc.severity] ?? 0.3,
    ] as [number, number, number])

    const radius = Math.max(8, Math.min(35, (zoom - 8) * 4))
    const blur = Math.round(radius * 0.55)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(points, {
      radius,
      blur,
      maxZoom: 18,
      minOpacity: 0.65,
      gradient: { 0.0: '#0000ff', 0.4: '#00ffff', 0.6: '#00ff00', 0.8: '#ffff00', 1.0: '#ff0000' },
    }).addTo(map)

    const overlayPane = map.getPanes().overlayPane
    const canvas = overlayPane?.querySelector('canvas')
    if (canvas) (canvas as HTMLCanvasElement).style.background = 'transparent'

    return () => { map.removeLayer(heat) }
  }, [map, incidents, zoom])

  return null
}

interface IncidentMapProps {
  incidents: Incident[]
  userLocation: Coordinates | null
  onMapClick?: (coords: Coordinates) => void
  showHeatZones?: boolean
  currentUserId?: string | null
  isAdmin?: boolean
  onEdit?: (incident: Incident) => void
  onDelete?: (incidentId: string) => void
  flyToUserTrigger?: number
}

export function IncidentMap({ incidents, userLocation, onMapClick, showHeatZones = true, currentUserId, isAdmin = false, onEdit, onDelete, flyToUserTrigger = 0 }: IncidentMapProps) {
  const { mapCenter, mapZoom } = useAppStore()

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return document.documentElement.className === 'dark'
  })
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers')

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.className === 'dark')
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const initialCenter = useMemo(() => {
    if (userLocation) return userLocation
    return mapCenter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-full w-full">
      <button
        onClick={() => setViewMode(v => v === 'markers' ? 'heatmap' : 'markers')}
        className="absolute top-3 left-3 z-[1000] flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shadow-md bg-background/90 border border-border hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        {viewMode === 'markers' ? '📍' : '🔥'}
        <span>{viewMode === 'markers' ? 'Marcadores' : 'Calor'}</span>
      </button>

      <MapContainer
        center={[initialCenter.latitude, initialCenter.longitude]}
        zoom={mapZoom}
        className="h-full w-full rounded-lg"
        zoomControl={false}
        attributionControl={false}
      >
        {isDark ? (
          <TileLayer
            key="dark-tiles"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap'
          />
        ) : (
          <TileLayer
            key="light-tiles"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap'
          />
        )}

        <MapUpdater center={initialCenter} zoom={mapZoom} />
        <FlyToController trigger={flyToUserTrigger} userLocation={userLocation} />

        {viewMode === 'heatmap' && showHeatZones && (
          <HeatLayer incidents={incidents} />
        )}

        {userLocation && (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
            <Popup>
              <div className="text-center p-1">
                <strong>Estás aquí</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {viewMode === 'markers' && incidents.map((incident) => {
          const isOwner = isAdmin || (currentUserId && incident.user_id === currentUserId)

          return (
            <Marker
              key={incident.id}
              position={[incident.latitude, incident.longitude]}
              icon={createIcon(severityColors[incident.severity] || severityColors.low)}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: severityColors[incident.severity] }} />
                    <strong className="text-sm">{incident.title}</strong>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{incidentTypeLabels[incident.incident_type] ?? incident.incident_type}</p>
                  {incident.description && <p className="text-xs text-gray-500 mb-2">{incident.description}</p>}
                  <p className="text-xs text-gray-400 mb-3">{new Date(incident.reported_at).toLocaleString()}</p>

                  {isOwner && (
                    <div className="flex gap-2 pt-1 border-t border-gray-200">
                      <button
                        onClick={() => onEdit?.(incident)}
                        className="flex-1 text-xs py-1 px-2 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => onDelete?.(incident.id)}
                        className="flex-1 text-xs py-1 px-2 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
