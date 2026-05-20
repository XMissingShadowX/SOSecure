/*
  Este archivo define el estado global de la aplicación utilizando Zustand, una biblioteca de gestión de estado para 
  React. El estado incluye información sobre la navegación, la ubicación del usuario, los incidentes cercanos, los 
  contactos de emergencia, el estado de las alertas SOS, las rutas y los lugares frecuentes. Además, se implementa 
  la persistencia del estado en el almacenamiento local del navegador para mantener la información entre sesiones. 
  Este enfoque centralizado facilita el acceso y la actualización del estado en toda la aplicación, mejorando la 
  experiencia del usuario y permitiendo una gestión eficiente de los datos relacionados con la seguridad personal.
*/

// Importar las funciones `create` y `persist` de la biblioteca Zustand para crear el estado global de la aplicación y
// persistirlo en el almacenamiento local del navegador. También se importan los tipos necesarios desde el módulo de tipos.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabId, Coordinates, Incident, EmergencyContact, SOSAlert, FrequentPlace, LocationHistory } from './types'

// Definir la interfaz `AppState` que describe la estructura del estado global de la aplicación, incluyendo propiedades 
// y funciones para manejar la navegación, la ubicación, los incidentes, los contactos, las alertas SOS, las rutas, 
// los lugares frecuentes, el temporizador de seguridad y la cola de incidentes sin conexión.
interface AppState {
  // Navegacion
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Ubicación
  currentLocation: Coordinates | null
  setCurrentLocation: (location: Coordinates) => void

  // Historial de ubicación — mantener últimos 10 min
  locationHistory: LocationHistory[]
  addLocationHistory: (loc: Coordinates) => void

  // Mapa
  mapCenter: Coordinates
  mapZoom: number
  setMapCenter: (center: Coordinates) => void
  setMapZoom: (zoom: number) => void

  // Incidentes
  nearbyIncidents: Incident[]
  setNearbyIncidents: (incidents: Incident[]) => void

  // Contactos
  contacts: EmergencyContact[]
  setContacts: (contacts: EmergencyContact[]) => void

  // SOS
  sosActive: boolean
  setSosActive: (active: boolean) => void
  sosAlert: SOSAlert | null
  setSosAlert: (alert: SOSAlert | null) => void

  // Rutas
  routeOrigin: Coordinates | null
  routeDestination: Coordinates | null
  setRouteOrigin: (origin: Coordinates | null) => void
  setRouteDestination: (destination: Coordinates | null) => void

  // Lugares frecuentes
  frequentPlaces: FrequentPlace[]
  setFrequentPlaces: (places: FrequentPlace[]) => void
  addFrequentPlace: (place: FrequentPlace) => void
  removeFrequentPlace: (id: string) => void

  // Temporizador de seguridad
  securityTimerActive: boolean
  securityTimerEnd: number | null
  setSecurityTimer: (active: boolean, endTime: number | null) => void

  // Cola sin conexión (incidentes para enviar cuando se vuelva en línea)
  offlineQueue: Incident[]
  addToOfflineQueue: (incident: Omit<Incident, 'id' | 'reported_at' | 'is_active' | 'resolved_at'>) => void
  clearOfflineQueue: () => void
}

// Crear el estado global de la aplicación utilizando Zustand y persistirlo en el almacenamiento local del navegador con 
// la clave 'sosecure-store'.
export const useAppStore = create<AppState>()(
  // Persistir solo partes del estado que son relevantes para mantener entre sesiones, como los contactos, 
  // la configuración del mapa, los lugares frecuentes, el historial de ubicación y la cola sin conexión.
  persist(
    (set, get) => ({
      // Navigation
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Ubicacion 
      currentLocation: null,
      setCurrentLocation: (location) => {
        set({ currentLocation: location })
        get().addLocationHistory(location)
      },

      // Historial de ubicación — mantener últimos 10 min
      locationHistory: [],
      addLocationHistory: (loc) => {
        const now = Date.now()
        const tenMinutes = 10 * 60 * 1000
        const history = get().locationHistory.filter(h => now - h.timestamp < tenMinutes)
        history.push({ coordinates: loc, timestamp: now })
        set({ locationHistory: history })
      },

      // Mapa
      mapCenter: { latitude: 20.9674, longitude: -89.6231 },
      mapZoom: 14,
      setMapCenter: (center) => set({ mapCenter: center }),
      setMapZoom: (zoom) => set({ mapZoom: zoom }),

      // Incidentes
      nearbyIncidents: [],
      setNearbyIncidents: (incidents) => set({ nearbyIncidents: incidents }),

      // Contactos
      contacts: [],
      setContacts: (contacts) => set({ contacts }),

      // SOS
      sosActive: false,
      setSosActive: (active) => set({ sosActive: active }),
      sosAlert: null,
      setSosAlert: (alert) => set({ sosAlert: alert }),

      // Rutas
      routeOrigin: null,
      routeDestination: null,
      setRouteOrigin: (origin) => set({ routeOrigin: origin }),
      setRouteDestination: (destination) => set({ routeDestination: destination }),

      // Lugares frecuentes
      frequentPlaces: [],
      setFrequentPlaces: (places) => set({ frequentPlaces: places }),
      addFrequentPlace: (place) => set({ frequentPlaces: [...get().frequentPlaces, place] }),
      removeFrequentPlace: (id) => set({ frequentPlaces: get().frequentPlaces.filter(p => p.id !== id) }),

      // Temporizador de seguridad
      securityTimerActive: false,
      securityTimerEnd: null,
      setSecurityTimer: (active, endTime) => set({ securityTimerActive: active, securityTimerEnd: endTime }),

      // Cola sin conexión
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
