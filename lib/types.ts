export type TabId = 'home' | 'map' | 'routes' | 'medic' | 'before' | 'during' | 'after'

export interface Coordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

export type IncidentType = 'theft' | 'assault' | 'harassment' | 'suspicious' | 'accident' | 'other'
export type IncidentSeverity = 'high' | 'medium' | 'low'

export interface Incident {
  id: string
  user_id: string | null
  title: string
  description: string | null
  incident_type: IncidentType
  severity: IncidentSeverity
  latitude: number
  longitude: number
  is_active: boolean
  is_verified: boolean        // ← también agrega este si te faltaba
  reported_at: string
  resolved_at: string | null
  false_alarm_count?: number
  votes_real?: number         // ← nuevo
  votes_fake?: number         // ← nuevo
}

export interface EmergencyContact {
  id: string
  user_id: string
  name: string
  phone: string
  relationship: string | null
  priority: number
  importance: 'primary' | 'secondary' | 'tertiary'
  created_at?: string
}

export interface SOSAlert {
  id: string
  user_id: string
  latitude: number
  longitude: number
  status: 'active' | 'resolved' | 'false_alarm'
  contacts_notified: string[]
  created_at: string
  resolved_at: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface SafetyScore {
  score: number
  incidents_nearby: number
  risk_level: 'safe' | 'caution' | 'danger'
}

export interface FrequentPlace {
  id: string
  label: string
  icon: string
  address: string
  coordinates: Coordinates
}

export interface SafeZone {
  id: string
  name: string
  type: 'pharmacy' | 'police' | 'hospital' | 'store' | 'other'
  latitude: number
  longitude: number
  address?: string
}

export interface LocationHistory {
  coordinates: Coordinates
  timestamp: number
}
