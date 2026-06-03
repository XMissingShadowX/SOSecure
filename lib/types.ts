/*
  Define los tipos y estructuras de datos utilizados en la aplicación, incluyendo coordenadas, incidentes, contactos de 
  emergencia, alertas SOS, mensajes de chat, puntuaciones de seguridad, lugares frecuentes, zonas seguras e historial de 
  ubicación.
*/

// Definir el tipo `TabId` que representa las diferentes pestañas de la aplicación, y la interfaz `Coordinates` 
// que describe las coordenadas geográficas con latitud, longitud y precisión opcional.
export type TabId = 'home' | 'before' | 'during' | 'after' | 'medic'

// Definir los tipos de incidentes y su gravedad, así como la interfaz `Incident` que describe un incidente reportado por 
// los usuarios, incluyendo su tipo, gravedad, ubicación, estado y otros detalles relevantes.
export interface Coordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

// Definir los tipos de incidentes y su gravedad, así como la interfaz `Incident` que describe un incidente reportado por 
// los usuarios, incluyendo su tipo, gravedad, ubicación, estado y otros detalles relevantes.
export type IncidentType = 'theft-assault-violence' | 'harassment-suspicious' | 'accident' | 'SOS'
export type IncidentSeverity = 'high' | 'medium' | 'low'

// La interfaz `Incident` describe un incidente reportado por los usuarios, incluyendo su tipo, gravedad, ubicación, 
// estado y otros detalles relevantes. Esta estructura es fundamental para gestionar y mostrar los incidentes en la aplicación,
// permitiendo a los usuarios estar informados sobre los riesgos en su entorno y tomar decisiones informadas para su seguridad.
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

// Definir la interfaz `EmergencyContact` que describe un contacto de emergencia guardado por el usuario, incluyendo su nombre,
// número de teléfono, relación con el usuario, prioridad y otros detalles relevantes. Esta estructura es esencial para gestionar 
// los contactos de emergencia en la aplicación, permitiendo a los usuarios agregar, editar y eliminar contactos, así como 
// utilizarlos para enviar alertas SOS en situaciones de emergencia.
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

// Definir la interfaz `SOSAlert` que describe una alerta SOS activada por el usuario, incluyendo su estado, ubicación, contactos
// notificados y otros detalles relevantes. Esta estructura es crucial para gestionar las alertas SOS en la aplicación, 
// permitiendo a los usuarios activar y resolver alertas, así como a los contactos de emergencia recibir notificaciones y 
// acceder a la ubicación del usuario en situaciones de emergencia.
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

// Definir la interfaz `ChatMessage` que describe un mensaje en el chat de asistencia virtual, incluyendo su contenido, 
// rol (usuario o asistente) y marca de tiempo. Esta estructura es fundamental para gestionar las conversaciones entre 
// el usuario y el asistente virtual, permitiendo almacenar y mostrar los mensajes de manera organizada en la aplicación.
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Definir la interfaz `SafetyScore` que describe la puntuación de seguridad de una ubicación, incluyendo el puntaje numérico,
// la cantidad de incidentes cercanos y el nivel de riesgo (seguro, precaución o peligroso). Esta estructura es esencial para 
// proporcionar a los usuarios información clara y concisa sobre la seguridad de su entorno, ayudándolos a tomar decisiones 
// informadas para su protección personal.
export interface SafetyScore {
  score: number
  incidents_nearby: number
  risk_level: 'safe' | 'caution' | 'danger'
}

export interface RouteOption {
  id: string
  name: string
  distance: string
  duration: string
  safetyScore: SafetyScore
  incidentsOnRoute: number
}

// Definir la interfaz `FrequentPlace` que describe un lugar frecuente guardado por el usuario, incluyendo su nombre, dirección,
// coordenadas y otros detalles relevantes. Esta estructura es importante para gestionar los lugares frecuentes en la aplicación, 
// permitiendo a los usuarios agregar, editar y eliminar lugares, así como utilizarlos para obtener información de seguridad o 
// planificar rutas.
export interface FrequentPlace {
  id: string
  label: string
  icon: string
  address: string
  coordinates: Coordinates
}

// Definir la interfaz `SafeZone` que describe una zona segura en la ciudad, incluyendo su nombre, tipo (farmacia, 
// policía, hospital, tienda u otro), ubicación y otros detalles relevantes. Esta estructura es crucial para gestionar 
// las zonas seguras en la aplicación, permitiendo a los usuarios identificar rápidamente lugares donde pueden 
// buscar ayuda o refugio en caso de emergencia.
export interface SafeZone {
  id: string
  name: string
  type: 'pharmacy' | 'police' | 'hospital' | 'store' | 'other'
  latitude: number
  longitude: number
  address?: string
}

// Definir la interfaz `LocationHistory` que describe un registro de ubicación del usuario, incluyendo las coordenadas y la
// marca de tiempo. Esta estructura es útil para mantener un historial de las ubicaciones del usuario, lo que puede ser 
// beneficioso para analizar patrones de movimiento, proporcionar información de seguridad basada en ubicaciones anteriores o 
// para compartir con contactos de emergencia en caso de una alerta SOS.
export interface LocationHistory {
  coordinates: Coordinates
  timestamp: number
}
