/*
  Componente principal para la pestaña de mapa, que muestra un mapa interactivo con los incidentes reportados 
  cerca del usuario, permite reportar nuevos incidentes, editar o eliminar los propios, y aplicar filtros para 
  visualizar solo ciertos tipos o severidades de incidentes. 
  También maneja la sincronización de reportes cuando el usuario está offline, mostrando un banner de estado y 
  guardando los reportes localmente hasta que se pueda enviar al servidor.
*/
'use client'

// Importaciones de React, componentes dinámicos, iconos, hooks personalizados, cliente de Supabase, y componentes de UI.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, RefreshCw, AlertTriangle, Filter, ShieldCheck, Pencil, Trash2, LocateFixed } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
import { scheduleIncidentReminder, cancelIncidentReminder } from '@/lib/incident-reminder'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import type { Incident, IncidentType, IncidentSeverity } from '@/lib/types'

// Carga dinámica del componente de mapa para evitar problemas con la renderización del lado del servidor, 
// mostrando un indicador de carga mientras se carga el mapa. El componente de mapa se importa desde 
// '@/components/incident-map' y se renderiza solo en el cliente.
const IncidentMap = dynamic(
  () => import('@/components/incident-map').then(mod => mod.IncidentMap),
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

// Definición de los tipos de incidentes y niveles de severidad disponibles para los reportes, que se utilizan 
// tanto en el formulario de reporte como en los filtros para mostrar u ocultar ciertos incidentes en el mapa y 
// la lista de incidentes recientes.
const incidentTypes: { value: IncidentType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'theft-assault-violence', label: 'Robo/Asalto/violencia' },
  { value: 'harassment-suspicious', label: 'Acoso/Actividad Sospechosa' },
  { value: 'accident', label: 'Accidente' },
  { value: 'SOS', label: 'Alerta SOS' },
]

// Estos mismos tipos se definen nuevamente para el formulario de reporte, sin la opción "all", ya que no es 
// relevante en ese contexto.
const incidentTypesForm: { value: IncidentType; label: string }[] = [
  { value: 'theft-assault-violence', label: 'Robo/Asalto/violencia' },
  { value: 'harassment-suspicious', label: 'Acoso/Actividad Sospechosa' },
  { value: 'accident', label: 'Accidente' },
  { value: 'SOS', label: 'Alerta SOS' },
]

// Definición de los niveles de severidad para los incidentes, con etiquetas y clases de color asociadas para su
// visualización en el formulario de reporte y en la leyenda del mapa.
const severityLevels: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'high', label: 'Alto', color: 'bg-destructive text-destructive-foreground' },
  { value: 'medium', label: 'Medio', color: 'bg-warning text-warning-foreground' },
  { value: 'low', label: 'Bajo', color: 'bg-primary text-primary-foreground' },
]

const incidentQuestions: Partial<Record<IncidentType, string[]>> = {
  'theft-assault-violence': [
    '¿Hubo uso de arma o amenaza con arma?',
    '¿Hubo violencia física contra alguna persona?',
    '¿La víctima resultó herida?',
  ],
  'harassment-suspicious': [
    '¿La persona sospechosa está siguiendo o persiguiendo a alguien?',
    '¿Hubo amenazas directas o comportamiento agresivo?',
    '¿Existe riesgo inmediato para una persona vulnerable (menor, adulto mayor, etc.)?',
  ],
  'accident': [
    '¿Hay personas lesionadas?',
    '¿Hay riesgo de incendio, explosión o fuga de combustible?',
    '¿El accidente bloquea completamente la circulación o pone en peligro a otros?',
  ],
}

function calculateSeverity(answers: string[]): IncidentSeverity {
  const score = answers.reduce((sum, a) => sum + (a === 'si' ? 1 : a === 'no_se' ? 0.5 : 0), 0)
  if (score >= 3) return 'high'
  if (score === 0) return 'low'
  return 'medium'
}

// Componente principal para la pestaña de mapa, que maneja la visualización del mapa con los incidentes, el reporte 
// de nuevos incidentes, la edición y eliminación de incidentes propios, la aplicación de filtros, y la sincronización 
// de reportes cuando el usuario está offline.
export function MapTab({ embedded = false, customMap }: { embedded?: boolean; customMap?: React.ReactNode }) {
  const { coordinates } = useGeolocation({ watch: true })
  const [mapTheme, setMapTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return document.documentElement.className === 'dark' ? 'dark' : 'light'
  })

  // Efecto para detectar cambios en el tema (clase 'dark' en el elemento raíz) y actualizar el estado del tema del 
  // mapa en consecuencia, lo que permite que el mapa cambie entre modo claro y oscuro según el tema actual de la aplicación.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMapTheme(document.documentElement.className === 'dark' ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Uso del estado global para manejar los incidentes cercanos, la ubicación actual del usuario, y la cola de reportes
  // offline.
  const { nearbyIncidents, setNearbyIncidents, currentLocation, addToOfflineQueue, offlineQueue } = useAppStore()
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all')
  const [filterType, setFilterType] = useState<IncidentType | 'all'>('all')
  const [filterTime, setFilterTime] = useState<'all' | '1d' | '7d' | '30d'>('7d')
  const [isOnline, setIsOnline] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [locateTrigger, setLocateTrigger] = useState(0)

  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    incident_type: 'theft-assault-violence' as IncidentType,
    severity: 'medium' as IncidentSeverity,
  })
  const [questionAnswers, setQuestionAnswers] = useState<string[]>(['', '', ''])
  const [reportError, setReportError] = useState<string | null>(null)

  // Efecto para obtener el ID del usuario actual desde Supabase Auth al montar el componente, lo que permite 
  // identificar qué incidentes fueron reportados por el usuario para permitir la edición y eliminación de esos incidentes.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
      setIsAdmin(user?.app_metadata?.role === 'admin')
    })
  }, [])

  // Efecto para detectar cambios en el estado de conexión a internet del navegador, actualizando el estado 'isOnline' 
  // en consecuencia. Esto permite mostrar un banner de estado cuando el usuario está offline, y manejar la 
  // sincronización de reportes guardados localmente cuando el usuario vuelve a estar online.
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  // Efecto para sincronizar la cola de reportes offline con el servidor cuando el usuario vuelve a estar online, 
  // llamando a la función 'syncOfflineQueue' que envía cada reporte guardado localmente al servidor, y luego 
  // limpia la cola de reportes offline y recarga los incidentes cercanos para reflejar los nuevos reportes enviados.
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) syncOfflineQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Función para sincronizar la cola de reportes offline con el servidor. Obtiene el usuario actual desde Supabase 
  // Auth, y para cada reporte en la cola offline, envía una solicitud de inserción a la tabla 'incidents' en 
  // Supabase con los datos del reporte.
  const syncOfflineQueue = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const inc of offlineQueue) {
      const { id, reported_at, is_active, resolved_at, ...rest } = inc
      void id; void reported_at; void is_active; void resolved_at
      await supabase.from('incidents').insert({ ...rest, user_id: user.id })
    }
    useAppStore.getState().clearOfflineQueue()
    loadIncidents()
  }

  // Función para cargar los incidentes activos desde la base de datos, ordenados por fecha de reporte, y 
  // actualizando el estado de 'nearbyIncidents' con los datos obtenidos. Esta función se llama al montar el 
  // componente para cargar los incidentes iniciales, y también se llama cada vez que se detecta un cambio en 
  // la tabla 'incidents' a través de la suscripción a cambios en tiempo real de Supabase, lo que permite 
  // mantener la lista de incidentes actualizada en tiempo real sin necesidad de recargar la página.
  const loadIncidents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('is_active', true)
      .order('reported_at', { ascending: false })
      .limit(100)
    if (data) setNearbyIncidents(data)
  }

  // Efecto para cargar los incidentes al montar el componente, y para suscribirse a cambios en la tabla 'incidents'
  useEffect(() => {
    // Cargar los incidentes al montar el componente, y luego establecer 'loading' en false para indicar que la carga 
    // ha terminado.
    loadIncidents().finally(() => setLoading(false))
    const supabase = createClient()
    const channel = supabase
      .channel('incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => loadIncidents())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Función para manejar la acción de refrescar los incidentes, que establece el estado de 'refreshing' en true, 
  // llama a la función 'loadIncidents' para recargar los incidentes desde la base de datos, y luego establece 
  // 'refreshing' en false una vez que la carga ha terminado. Esto permite mostrar un indicador de carga en el 
  // botón de refrescar mientras se están cargando los incidentes.
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadIncidents()
    setRefreshing(false)
  }

  // Función para manejar el reporte de un nuevo incidente. Verifica que se haya proporcionado un título y que 
  // haya coordenadas disponibles, y luego, si el usuario está offline, agrega el reporte a la cola de reportes 
  // offline para que se envíe al servidor cuando el usuario vuelva a estar online. Si el usuario está online, 
  // envía una solicitud de inserción a la tabla 'incidents' en Supabase con los datos del nuevo incidente, y 
  // luego recarga los incidentes para reflejar el nuevo reporte. Además, si el reporte se envió correctamente 
  // al servidor, invoca una función de Supabase para notificar a los usuarios cercanos sobre el nuevo incidente reportado.
  const reportIncident = async () => {
    // Verificar que se haya proporcionado un título para el incidente y que haya coordenadas disponibles 
    // antes de continuar con el reporte. Si falta alguno de estos datos, no se puede reportar el incidente, 
    // por lo que la función simplemente retorna sin hacer nada.
    setReportError(null)
    const questions = incidentQuestions[newIncident.incident_type] || []
    const allAnswered = questions.length === 0 || questionAnswers.every(a => a !== '')
    if (!coordinates || !allAnswered) return

    const autoTitle = incidentTypesForm.find(t => t.value === newIncident.incident_type)?.label || 'Incidente'
    const autoSeverity: IncidentSeverity = questions.length > 0 ? calculateSeverity(questionAnswers) : 'medium'

    if (!isOnline) {
      addToOfflineQueue({
        user_id: null,
        title: autoTitle,
        description: newIncident.description || null,
        incident_type: newIncident.incident_type,
        severity: autoSeverity,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        })
      setNewIncident({ title: '', description: '', incident_type: 'theft-assault-violence', severity: 'medium' })
      setQuestionAnswers(['', '', ''])
      setShowReportDialog(false)
      return
    }

    // Si el usuario está online, se crea una instancia del cliente de Supabase, se obtiene el usuario actual 
    // desde Supabase Auth, y luego se envía una solicitud de inserción a la tabla 'incidents' con los datos del 
    // nuevo incidente.
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Se inserta el nuevo incidente en la tabla 'incidents' con los datos proporcionados en el formulario, junto con 
    // las coordenadas actuales del usuario, y se marca como no verificado. Luego, se limpia el formulario de nuevo 
    // incidente, se cierra el diálogo de reporte, y se recarga la lista de incidentes para reflejar el nuevo reporte.
    const { data, error } = await supabase.from('incidents').insert({
      user_id: user?.id || null,
      title: autoTitle,
      description: newIncident.description || null,
      incident_type: newIncident.incident_type,
      severity: autoSeverity,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    }).select().single()

    if (error) {
      console.error('Error al reportar incidente:', error)
      setReportError(error.message || 'Error al enviar el reporte. Intenta de nuevo.')
    } else {
      setNewIncident({ title: '', description: '', incident_type: 'theft-assault-violence', severity: 'medium' })
      setQuestionAnswers(['', '', ''])
      setReportError(null)
      setShowReportDialog(false)
      loadIncidents()
      if (data) scheduleIncidentReminder(data.id)
    }

    // Si el incidente se insertó correctamente y se obtuvo el ID del nuevo incidente, se invoca una función de 
    // Supabase para notificar a los usuarios cercanos sobre el nuevo incidente reportado, enviando el ID del 
    // incidente, las coordenadas, el título y la severidad como parte de la notificación.
    if (!error && data) {
      await supabase.functions.invoke('notify-nearby-users', {
        body: { incident_id: data.id, incident_lat: coordinates.latitude, incident_lng: coordinates.longitude, title: autoTitle, severity: autoSeverity }
      })
    }
  }

  // Función para manejar la acción de editar un incidente. Recibe el incidente a editar como argumento, establece el 
  // estado de 'editingIncident' con el incidente seleccionado, y luego muestra el diálogo de edición estableciendo 
  // 'showEditDialog' en true. Esto permite que el usuario edite los detalles del incidente seleccionado en un 
  // formulario dentro del diálogo.
  const handleEdit = (incident: Incident) => {
    setEditingIncident(incident)
    setShowEditDialog(true)
  }

  // Función para guardar los cambios realizados en un incidente editado. Verifica que haya un incidente seleccionado 
  // para editar, y luego envía una solicitud de actualización a la tabla 'incidents' en Supabase con los datos 
  // actualizados del incidente. Después de guardar los cambios, se cierra el diálogo de edición, se limpia el estado 
  // de 'editingIncident', y se recarga la lista de incidentes para reflejar los cambios realizados.
  const saveEdit = async () => {
    if (!editingIncident) return
    const supabase = createClient()
    await supabase.from('incidents').update({
      title: editingIncident.title,
      description: editingIncident.description,
      incident_type: editingIncident.incident_type,
      severity: editingIncident.severity,
    }).eq('id', editingIncident.id)
    cancelIncidentReminder(editingIncident.id)
    setShowEditDialog(false)
    setEditingIncident(null)
    loadIncidents()
  }

  // Función para manejar la acción de eliminar un incidente. Recibe el ID del incidente a eliminar como argumento,
  // muestra una confirmación al usuario para asegurarse de que desea eliminar el incidente, y si el usuario
  // confirma, envía una solicitud de eliminación a la tabla 'incidents' en Supabase para eliminar el incidente
  // con el ID especificado. Después de eliminar el incidente, se recarga la lista de incidentes para reflejar
  // la eliminación.
  const handleDelete = async (incidentId: string) => {
    if (!confirm('¿Seguro que quieres eliminar este incidente?')) return
    const supabase = createClient()
    await supabase.from('incidents').delete().eq('id', incidentId)
    cancelIncidentReminder(incidentId)
    loadIncidents()
  }

  // Filtrar los incidentes cercanos según los filtros de severidad, tipo y tiempo seleccionados por el usuario.
  const filteredIncidents = nearbyIncidents.filter(i => {
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false
    if (filterType !== 'all' && i.incident_type !== filterType) return false
    if (filterTime !== 'all') {
      const now = new Date()
      const reported = new Date(i.reported_at)
      const diffDays = (now.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24)
      if (filterTime === '1d' && diffDays > 1) return false
      if (filterTime === '7d' && diffDays > 7) return false
      if (filterTime === '30d' && diffDays > 30) return false
    }
    return true
  })

  // Calcular la cantidad de incidentes cercanos por nivel de severidad para mostrar en la leyenda del mapa y 
  // en el banner de estado.
  const incidentCounts = {
    high: nearbyIncidents.filter(i => i.severity === 'high').length,
    medium: nearbyIncidents.filter(i => i.severity === 'medium').length,
    low: nearbyIncidents.filter(i => i.severity === 'low').length,
  }

  // Renderizar la UI de la pestaña de mapa, que incluye un banner de estado cuando el usuario está offline, el mapa 
  // con los incidentes filtrados, un botón flotante para refrescar los incidentes, una leyenda flotante para mostrar 
  // la severidad de los incidentes, y un botón flotante para reportar nuevos incidentes. Además, se incluyen diálogos 
  // para reportar nuevos incidentes y editar incidentes existentes, con formularios para ingresar los detalles del 
  // incidente a reportar o editar.
  return (
    <div className={embedded ? "flex flex-col gap-2" : "flex flex-col h-[calc(100vh-4rem)] pb-24 gap-2"}>

      {/* Banner offline — solo aparece si no hay internet, altura fija */}
      {!isOnline && (
        <div className="flex-none px-3 py-2 bg-warning/20 text-warning rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Sin internet — los reportes se guardan localmente y se enviarán al reconectarte.
          {offlineQueue.length > 0 && <Badge variant="secondary">{offlineQueue.length} pendientes</Badge>}
        </div>
      )}

      {/* ── MAPA ── */}
      <div className={embedded ? "relative h-[350px] rounded-lg overflow-hidden z-0" : "relative flex-1 min-h-0 rounded-lg overflow-hidden"} style={{ isolation: 'isolate' }}>
        {customMap ?? (loading ? (
          <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Cargando incidentes...</span>
            </div>
          </div>
        ) : (
          <IncidentMap
            key={mapTheme}
            incidents={filteredIncidents}
            userLocation={currentLocation || coordinates || null}
            showHeatZones={true}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            flyToUserTrigger={locateTrigger}
          />
        ))}

        {/* Refresh + Locate — flotantes arriba derecha */}
        <div className="absolute top-3 right-3 z-[1000] flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="shadow-lg bg-card text-foreground border border-border hover:bg-muted"
            onClick={() => setLocateTrigger(t => t + 1)}
            disabled={!coordinates}
            title="Ir a mi ubicación"
          >
            <LocateFixed className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="shadow-lg bg-card text-foreground border border-border hover:bg-muted"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Recargar incidentes"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Leyenda — flotante abajo izquierda */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <p className="text-xs font-medium mb-2">Severidad</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-destructive" /><span>Alta ({incidentCounts.high})</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-warning" /><span>Media ({incidentCounts.medium})</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-primary" /><span>Baja ({incidentCounts.low})</span></div>
            <div className="flex items-center gap-2 text-xs"><ShieldCheck className="w-3 h-3 text-safe" /><span>Zona segura</span></div>
          </div>
        </div>

        {/* Botón Reportar — flotante abajo derecha sobre el mapa */}
        <div className="absolute bottom-3 right-3 z-[1000]">
          <Dialog open={showReportDialog} onOpenChange={(open) => {
            setShowReportDialog(open)
            if (!open) {
              setNewIncident({ title: '', description: '', incident_type: 'theft-assault-violence', severity: 'medium' })
              setQuestionAnswers(['', '', ''])
              setReportError(null)
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="shadow-lg">
                <Plus className="w-4 h-4 mr-1" />
                Reportar
              </Button>
            </DialogTrigger>
            <DialogContent className="z-[2000]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Reportar un Incidente
                </DialogTitle>
                <DialogDescription>
                  Ayuda a mantener segura tu comunidad reportando incidentes en tu zona.
                  {!isOnline && ' (Sin internet — se guardará localmente)'}
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>Tipo de Incidente</FieldLabel>
                  <Select value={newIncident.incident_type} onValueChange={(v) => {
                    setNewIncident({ ...newIncident, incident_type: v as IncidentType })
                    setQuestionAnswers(['', '', ''])
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {incidentTypesForm.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {(incidentQuestions[newIncident.incident_type] || []).map((question, idx) => (
                  <Field key={idx}>
                    <FieldLabel>{question}</FieldLabel>
                    <div className="flex gap-2">
                      {(['si', 'no', 'no_se'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const next = [...questionAnswers]
                            next[idx] = opt
                            setQuestionAnswers(next)
                          }}
                          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                            questionAnswers[idx] === opt
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {opt === 'si' ? 'Sí' : opt === 'no' ? 'No' : 'No sé'}
                        </button>
                      ))}
                    </div>
                  </Field>
                ))}
                <Field>
                  <FieldLabel>Detalles (Opcional)</FieldLabel>
                  <Textarea placeholder="Detalles adicionales..." rows={3} value={newIncident.description} onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })} />
                </Field>
                {coordinates && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Se registrará tu ubicación actual:</p>
                    <p className="font-mono text-sm">{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</p>
                  </div>
                )}
              </FieldGroup>
              {reportError && (
                <p className="text-sm text-destructive px-1">{reportError}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancelar</Button>
                <Button onClick={reportIncident} disabled={!coordinates || ((incidentQuestions[newIncident.incident_type]?.length ?? 0) > 0 && questionAnswers.some(a => a === ''))}>
                  {isOnline ? 'Enviar Reporte' : 'Guardar Localmente'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Filtros — flex-none, altura fija ── */}
      <div className="flex-none flex items-center gap-2">
        <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as IncidentSeverity | 'all')}>
          <SelectTrigger className="flex-1">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Severidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Severidad</SelectItem>
            <SelectItem value="high">Solo Alto</SelectItem>
            <SelectItem value="medium">Solo Medio</SelectItem>
            <SelectItem value="low">Solo Bajo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => setFilterType(v as IncidentType | 'all')}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {incidentTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTime} onValueChange={(v) => setFilterTime(v as 'all' | '1d' | '7d' | '30d' | 'all')}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Tiempo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier fecha</SelectItem>
            <SelectItem value="1d">Último día</SelectItem>
            <SelectItem value="7d">Última semana</SelectItem>
            <SelectItem value="30d">Último mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Incidentes recientes — flex-none, scroll interno ── */}
      <Card className="flex-none">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Incidentes Recientes
            <Badge variant="secondary" className="!text-black dark:!text-white">{filteredIncidents.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[130px] overflow-y-auto space-y-2 pb-3">
          {filteredIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin incidentes reportados cerca</p>
          ) : (
            filteredIncidents.slice(0, 5).map((incident) => (
              <div key={incident.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: incident.severity === 'high' ? '#ef4444' : incident.severity === 'medium' ? '#f59e0b' : '#3b82f6' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(incident.reported_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  {(isAdmin || incident.user_id === currentUserId) && (
                    <>
                      <button onClick={() => handleEdit(incident)} className="p-1 hover:text-primary transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(incident.id)} className="p-1 hover:text-destructive transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog de edición */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="z-[2000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Incidente
            </DialogTitle>
          </DialogHeader>
          {editingIncident && (
            <FieldGroup>
              <Field>
                <FieldLabel>Título</FieldLabel>
                <Input value={editingIncident.title} onChange={(e) => setEditingIncident({ ...editingIncident, title: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel>Tipo de Incidente</FieldLabel>
                <Select value={editingIncident.incident_type} onValueChange={(v) => setEditingIncident({ ...editingIncident, incident_type: v as IncidentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incidentTypesForm.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Severidad</FieldLabel>
                <div className="flex gap-2">
                  {severityLevels.map((level) => (
                    <button key={level.value} type="button"
                      onClick={() => setEditingIncident({ ...editingIncident, severity: level.value })}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        editingIncident.severity === level.value ? level.color : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >{level.label}</button>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldLabel>Detalles</FieldLabel>
                <Textarea rows={3} value={editingIncident.description || ''} onChange={(e) => setEditingIncident({ ...editingIncident, description: e.target.value })} />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}