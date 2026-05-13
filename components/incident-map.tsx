//incident-map.tsx
'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
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

// Key de sessionStorage para votos en el mapa (compartida con after-tab)
const SESSION_VOTED_KEY = 'safewalk_voted_incidents'

function getMapVotedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_VOTED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markMapVoted(id: string): void {
  const ids = getMapVotedIds()
  ids.add(id)
  sessionStorage.setItem(SESSION_VOTED_KEY, JSON.stringify([...ids]))
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

  // Estado de votos en el mapa: { [incidentId]: { real, fake, voted } }
  const [mapVotes, setMapVotes] = useState<Record<string, { real: number; fake: number; voted: boolean }>>(() => {
    const voted = getMapVotedIds()
    const initial: Record<string, { real: number; fake: number; voted: boolean }> = {}
    for (const inc of incidents) {
      initial[inc.id] = {
        real: inc.votes_real ?? 0,
        fake: inc.votes_fake ?? 0,
        voted: voted.has(inc.id),
      }
    }
    return initial
  })

  // Sincronizar mapVotes cuando cambian los incidents (ej: nueva carga)
  // DESPUÉS — siempre sincroniza conteos de la DB, respeta voted local
useEffect(() => {
  const voted = getMapVotedIds()
  setMapVotes(prev => {
    const next = { ...prev }
    for (const inc of incidents) {
      next[inc.id] = {
        real: inc.votes_real ?? 0,
        fake: inc.votes_fake ?? 0,
        // si ya votó localmente, respetar ese estado
        voted: voted.has(inc.id) || prev[inc.id]?.voted === true,
      }
    }
    return next
  })
}, [incidents])

  const handleMapVerify = useCallback(async (incident: Incident, verified: boolean) => {
    if (mapVotes[incident.id]?.voted) return

    // Optimistic update
    setMapVotes(prev => ({
      ...prev,
      [incident.id]: {
        real: (prev[incident.id]?.real ?? 0) + (verified ? 1 : 0),
        fake: (prev[incident.id]?.fake ?? 0) + (verified ? 0 : 1),
        voted: true,
      },
    }))
    markMapVoted(incident.id)

    const supabase = createClient()

    if (verified) {
      const { error } = await supabase.rpc('increment_votes', {
        incident_id: incident.id,
        vote_column: 'votes_real',
      })
      if (error) console.error('Error votando real:', error)
    } else {
      const { error } = await supabase.rpc('increment_votes', {
        incident_id: incident.id,
        vote_column: 'votes_fake',
      })
      if (error) console.error('Error votando falso:', error)

      // Desactivar aparte
      await supabase
        .from('incidents')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('id', incident.id)
    }
  }, [mapVotes])

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

      {incidents.map((incident) => {
        const isOwner = currentUserId && incident.user_id === currentUserId
        const votes = mapVotes[incident.id] ?? { real: incident.votes_real ?? 0, fake: incident.votes_fake ?? 0, voted: false }
        const totalVotes = votes.real + votes.fake

        return (
          <Marker
            key={incident.id}
            position={[incident.latitude, incident.longitude]}
            icon={createIcon(severityColors[incident.severity] || severityColors.low)}
          >
            <Popup>
              <div className="p-2 min-w-[210px]">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: severityColors[incident.severity] }} />
                  <strong className="text-sm">{incident.title}</strong>
                </div>
                <p className="text-xs text-gray-600 mb-1">{incidentTypeLabels[incident.incident_type]}</p>
                {incident.description && <p className="text-xs text-gray-500 mb-2">{incident.description}</p>}
                <p className="text-xs text-gray-400 mb-3">{new Date(incident.reported_at).toLocaleString()}</p>

                {/* Conteo de votos */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-t border-gray-100 pt-2">
                  <span className="text-xs text-gray-400">{totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}:</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      border: '1px solid #22c55e66',
                      color: '#16a34a',
                      fontWeight: 500,
                    }}
                  >
                    👍 {votes.real}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      border: '1px solid #ef444466',
                      color: '#dc2626',
                      fontWeight: 500,
                    }}
                  >
                    👎 {votes.fake}
                  </span>
                </div>

                {/* Acciones */}
                {isOwner ? (
                  /* Dueño: editar / eliminar */
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
                ) : (
                  /* Otros usuarios: verificar */
                  !incident.is_verified && (
                    <div className="pt-1 border-t border-gray-200">
                      {votes.voted ? (
                        <p
                          style={{
                            fontSize: '11px',
                            textAlign: 'center',
                            color: '#9ca3af',
                            padding: '4px 0',
                          }}
                        >
                          ✅ Ya votaste en este incidente
                        </p>
                      ) : (
                        <>
                          <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', textAlign: 'center' }}>
                            ¿Es real este incidente?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMapVerify(incident, true)}
                              style={{
                                flex: 1,
                                fontSize: '12px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                border: '1px solid #86efac',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                fontWeight: 500,
                              }}
                              onMouseOver={e => (e.currentTarget.style.background = '#dcfce7')}
                              onMouseOut={e => (e.currentTarget.style.background = '#f0fdf4')}
                            >
                              👍 Real
                            </button>
                            <button
                              onClick={() => handleMapVerify(incident, false)}
                              style={{
                                flex: 1,
                                fontSize: '12px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: '#fff1f2',
                                color: '#dc2626',
                                border: '1px solid #fca5a5',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                fontWeight: 500,
                              }}
                              onMouseOver={e => (e.currentTarget.style.background = '#fee2e2')}
                              onMouseOut={e => (e.currentTarget.style.background = '#fff1f2')}
                            >
                              👎 Falso
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}