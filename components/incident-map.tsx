'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
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
  theft: 'Robo',
  assault: 'Asalto',
  harassment: 'Acoso',
  suspicious: 'Actividad sospechosa',
  accident: 'Accidente',
  other: 'Otro',
}

interface MapUpdaterProps {
  center: Coordinates
  zoom: number
}

function MapUpdater({ center, zoom }: MapUpdaterProps) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom)
  }, [map, center, zoom])
  return null
}

interface IncidentMapProps {
  incidents: Incident[]
  userLocation: Coordinates | null
  onMapClick?: (coords: Coordinates) => void
  showHeatZones?: boolean
  currentUserId?: string | null
  onEdit?: (incident: Incident) => void
  onDelete?: (incidentId: string) => void
}

export function IncidentMap({ incidents, userLocation, onMapClick, showHeatZones = true, currentUserId, onEdit, onDelete }: IncidentMapProps) {
  const { mapCenter, mapZoom } = useAppStore()

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return document.documentElement.className === 'dark'
  })
  const [tileKey, setTileKey] = useState(Date.now())

  useEffect(() => {
    const updateTheme = () => {
      const dark = document.documentElement.className === 'dark'
      setIsDark(dark)
      setTileKey(Date.now())
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const center = useMemo(() => {
    if (userLocation) return userLocation
    return mapCenter
  }, [userLocation, mapCenter])

  const heatZones = useMemo(() => {
    if (!showHeatZones) return []
    return incidents.filter(i => i.severity === 'high').map(incident => ({
      center: [incident.latitude, incident.longitude] as [number, number],
      radius: 200,
      color: '#ef4444',
    }))
  }, [incidents, showHeatZones])

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
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

      <MapUpdater center={center} zoom={mapZoom} />

      {heatZones.map((zone, index) => (
        <Circle
          key={`zone-${index}`}
          center={zone.center}
          radius={zone.radius}
          pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.2, weight: 1 }}
        />
      ))}

      {userLocation && (
        <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
          <Popup>
            <div className="text-center p-1">
              <strong>Estás aquí</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {incidents.map((incident) => (
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
              <p className="text-xs text-gray-600 mb-1">{incidentTypeLabels[incident.incident_type]}</p>
              {incident.description && <p className="text-xs text-gray-500 mb-2">{incident.description}</p>}
              <p className="text-xs text-gray-400 mb-2">{new Date(incident.reported_at).toLocaleString()}</p>
              {currentUserId && incident.user_id === currentUserId && (
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
      ))}
    </MapContainer>
  )
}