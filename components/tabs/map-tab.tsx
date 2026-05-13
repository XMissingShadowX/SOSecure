//map-tab.tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, RefreshCw, AlertTriangle, Filter, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
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

const incidentTypes: { value: IncidentType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'theft', label: 'Robo' },
  { value: 'assault', label: 'Asalto' },
  { value: 'harassment', label: 'Acoso' },
  { value: 'suspicious', label: 'Actividad Sospechosa' },
  { value: 'accident', label: 'Accidente' },
  { value: 'other', label: 'Otro' },
]

const incidentTypesForm: { value: IncidentType; label: string }[] = [
  { value: 'theft', label: 'Robo' },
  { value: 'assault', label: 'Asalto' },
  { value: 'harassment', label: 'Acoso' },
  { value: 'suspicious', label: 'Actividad Sospechosa' },
  { value: 'accident', label: 'Accidente' },
  { value: 'other', label: 'Otro' },
]

const severityLevels: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'high', label: 'Alto', color: 'bg-destructive text-destructive-foreground' },
  { value: 'medium', label: 'Medio', color: 'bg-warning text-warning-foreground' },
  { value: 'low', label: 'Bajo', color: 'bg-primary text-primary-foreground' },
]

export function MapTab() {
  const { coordinates } = useGeolocation({ watch: true })
  const [mapTheme, setMapTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return document.documentElement.className === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMapTheme(document.documentElement.className === 'dark' ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const { nearbyIncidents, setNearbyIncidents, currentLocation, addToOfflineQueue, offlineQueue } = useAppStore()
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all')
  const [filterType, setFilterType] = useState<IncidentType | 'all'>('all')
  const [filterTime, setFilterTime] = useState<'all' | '1d' | '7d' | '30d'>('all')
  const [isOnline, setIsOnline] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    incident_type: 'suspicious' as IncidentType,
    severity: 'medium' as IncidentSeverity,
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) syncOfflineQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

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

  useEffect(() => {
    loadIncidents().finally(() => setLoading(false))
    const supabase = createClient()
    const channel = supabase
      .channel('incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => loadIncidents())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadIncidents()
    setRefreshing(false)
  }

  const reportIncident = async () => {
    if (!newIncident.title || !coordinates) return

    if (!isOnline) {
      addToOfflineQueue({
        user_id: null,
        title: newIncident.title,
        description: newIncident.description || null,
        incident_type: newIncident.incident_type,
        severity: newIncident.severity,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        is_verified: false,
      })
      setNewIncident({ title: '', description: '', incident_type: 'suspicious', severity: 'medium' })
      setShowReportDialog(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('incidents').insert({
      user_id: user?.id || null,
      title: newIncident.title,
      description: newIncident.description || null,
      incident_type: newIncident.incident_type,
      severity: newIncident.severity,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      is_verified: false,
    }).select().single()

    if (!error) {
      setNewIncident({ title: '', description: '', incident_type: 'suspicious', severity: 'medium' })
      setShowReportDialog(false)
      loadIncidents()
    }

    if (!error && data) {
      await supabase.functions.invoke('notify-nearby-users', {
        body: { incident_id: data.id, incident_lat: coordinates.latitude, incident_lng: coordinates.longitude, title: newIncident.title, severity: newIncident.severity }
      })
    }
  }

  const handleEdit = (incident: Incident) => {
    setEditingIncident(incident)
    setShowEditDialog(true)
  }

  const saveEdit = async () => {
    if (!editingIncident) return
    const supabase = createClient()
    await supabase.from('incidents').update({
      title: editingIncident.title,
      description: editingIncident.description,
      incident_type: editingIncident.incident_type,
      severity: editingIncident.severity,
    }).eq('id', editingIncident.id)
    setShowEditDialog(false)
    setEditingIncident(null)
    loadIncidents()
  }

  const handleDelete = async (incidentId: string) => {
    if (!confirm('¿Seguro que quieres eliminar este incidente?')) return
    const supabase = createClient()
    await supabase.from('incidents').delete().eq('id', incidentId)
    loadIncidents()
  }

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

  const incidentCounts = {
    high: nearbyIncidents.filter(i => i.severity === 'high').length,
    medium: nearbyIncidents.filter(i => i.severity === 'medium').length,
    low: nearbyIncidents.filter(i => i.severity === 'low').length,
  }

  return (
    // flex-col que ocupa exactamente el viewport menos la nav, sin scroll externo
    <div className="flex flex-col h-[calc(100vh-4rem)] pb-24 gap-2">

      {/* Banner offline — solo aparece si no hay internet, altura fija */}
      {!isOnline && (
        <div className="flex-none px-3 py-2 bg-warning/20 text-warning rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Sin internet — los reportes se guardan localmente y se enviarán al reconectarte.
          {offlineQueue.length > 0 && <Badge variant="secondary">{offlineQueue.length} pendientes</Badge>}
        </div>
      )}

      {/* ── MAPA ── flex-1 + min-h-0 es la clave: ocupa todo el espacio sobrante */}
      <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden">
        {loading ? (
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
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {/* Refresh — flotante arriba derecha */}
        <div className="absolute top-3 right-3 z-[1000]">
          <Button
            size="icon"
            variant="secondary"
            className="shadow-lg bg-card text-foreground border border-border hover:bg-muted"
            onClick={handleRefresh}
            disabled={refreshing}
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
          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
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
                  <FieldLabel>¿Qué pasó?</FieldLabel>
                  <Input placeholder="Descripción breve" value={newIncident.title} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>Tipo de Incidente</FieldLabel>
                  <Select value={newIncident.incident_type} onValueChange={(v) => setNewIncident({ ...newIncident, incident_type: v as IncidentType })}>
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
                        onClick={() => setNewIncident({ ...newIncident, severity: level.value })}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          newIncident.severity === level.value ? level.color : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >{level.label}</button>
                    ))}
                  </div>
                </Field>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancelar</Button>
                <Button onClick={reportIncident} disabled={!newIncident.title || !coordinates}>
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

        <Select value={filterTime} onValueChange={(v) => setFilterTime(v as 'all' | '1d' | '7d' | '30d')}>
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
                  {incident.is_verified && <Badge variant="outline" className="text-xs text-safe border-safe">✓</Badge>}
                  {incident.user_id === currentUserId && (
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