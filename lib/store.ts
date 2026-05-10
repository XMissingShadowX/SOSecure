import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabId, Coordinates, Incident, EmergencyContact, SOSAlert, FrequentPlace, LocationHistory } from './types'

interface AppState {
  // Navigation
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Location
  currentLocation: Coordinates | null
  setCurrentLocation: (location: Coordinates) => void

  // Location history (last 10 min for anti-kidnapping)
  locationHistory: LocationHistory[]
  addLocationHistory: (loc: Coordinates) => void

  // Map
  mapCenter: Coordinates
  mapZoom: number
  setMapCenter: (center: Coordinates) => void
  setMapZoom: (zoom: number) => void

  // Incidents
  nearbyIncidents: Incident[]
  setNearbyIncidents: (incidents: Incident[]) => void

  // Contacts
  contacts: EmergencyContact[]
  setContacts: (contacts: EmergencyContact[]) => void

  // SOS
  sosActive: boolean
  setSosActive: (active: boolean) => void
  sosAlert: SOSAlert | null
  setSosAlert: (alert: SOSAlert | null) => void

  // Routes
  routeOrigin: Coordinates | null
  routeDestination: Coordinates | null
  setRouteOrigin: (origin: Coordinates | null) => void
  setRouteDestination: (destination: Coordinates | null) => void

  // Frequent places
  frequentPlaces: FrequentPlace[]
  setFrequentPlaces: (places: FrequentPlace[]) => void
  addFrequentPlace: (place: FrequentPlace) => void
  removeFrequentPlace: (id: string) => void

  // Security timer
  securityTimerActive: boolean
  securityTimerEnd: number | null
  setSecurityTimer: (active: boolean, endTime: number | null) => void

  // Offline queue (incidents to send when back online)
  offlineQueue: Incident[]
  addToOfflineQueue: (incident: Omit<Incident, 'id' | 'reported_at' | 'is_active' | 'resolved_at'>) => void
  clearOfflineQueue: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Location
      currentLocation: null,
      setCurrentLocation: (location) => {
        set({ currentLocation: location })
        get().addLocationHistory(location)
      },

      // Location history — keep last 10 min
      locationHistory: [],
      addLocationHistory: (loc) => {
        const now = Date.now()
        const tenMinutes = 10 * 60 * 1000
        const history = get().locationHistory.filter(h => now - h.timestamp < tenMinutes)
        history.push({ coordinates: loc, timestamp: now })
        set({ locationHistory: history })
      },

      // Map
      mapCenter: { latitude: 20.9674, longitude: -89.6231 },
      mapZoom: 14,
      setMapCenter: (center) => set({ mapCenter: center }),
      setMapZoom: (zoom) => set({ mapZoom: zoom }),

      // Incidents
      nearbyIncidents: [],
      setNearbyIncidents: (incidents) => set({ nearbyIncidents: incidents }),

      // Contacts
      contacts: [],
      setContacts: (contacts) => set({ contacts }),

      // SOS
      sosActive: false,
      setSosActive: (active) => set({ sosActive: active }),
      sosAlert: null,
      setSosAlert: (alert) => set({ sosAlert: alert }),

      // Routes
      routeOrigin: null,
      routeDestination: null,
      setRouteOrigin: (origin) => set({ routeOrigin: origin }),
      setRouteDestination: (destination) => set({ routeDestination: destination }),

      // Frequent places
      frequentPlaces: [],
      setFrequentPlaces: (places) => set({ frequentPlaces: places }),
      addFrequentPlace: (place) => set({ frequentPlaces: [...get().frequentPlaces, place] }),
      removeFrequentPlace: (id) => set({ frequentPlaces: get().frequentPlaces.filter(p => p.id !== id) }),

      // Security timer
      securityTimerActive: false,
      securityTimerEnd: null,
      setSecurityTimer: (active, endTime) => set({ securityTimerActive: active, securityTimerEnd: endTime }),

      // Offline queue
      offlineQueue: [],
      addToOfflineQueue: (incident) => {
        const full = {
          ...incident,
          id: `offline_${Date.now()}`,
          reported_at: new Date().toISOString(),
          is_active: true,
          resolved_at: null,
        } as Incident
        set({ offlineQueue: [...get().offlineQueue, full] })
      },
      clearOfflineQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: 'sosecure-store',
      partialize: (state) => ({
        contacts: state.contacts,
        mapCenter: state.mapCenter,
        mapZoom: state.mapZoom,
        frequentPlaces: state.frequentPlaces,
        locationHistory: state.locationHistory,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
)
