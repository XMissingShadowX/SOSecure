'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, RefreshCw, AlertTriangle, Filter } from 'lucide-react'
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

// Dynamic import to avoid SSR issues with Leaflet
const IncidentMap = dynamic(
  () => import('@/components/incident-map').then(mod => mod.IncidentMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading map...</span>
        </div>
      </div>
    )
  }
)

const incidentTypes: { value: IncidentType; label: string }[] = [
  { value: 'theft', label: 'Theft' },
  { value: 'assault', label: 'Assault' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'suspicious', label: 'Suspicious Activity' },
  { value: 'accident', label: 'Accident' },
  { value: 'other', label: 'Other' },
]

const severityLevels: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'bg-destructive text-destructive-foreground' },
  { value: 'medium', label: 'Medium', color: 'bg-warning text-warning-foreground' },
  { value: 'low', label: 'Low', color: 'bg-primary text-primary-foreground' },
]

export function MapTab() {
  const { coordinates } = useGeolocation({ watch: true })
  const { nearbyIncidents, setNearbyIncidents, currentLocation } = useAppStore()
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all')
  
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    incident_type: 'suspicious' as IncidentType,
    severity: 'medium' as IncidentSeverity,
  })

  const loadIncidents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('is_active', true)
      .order('reported_at', { ascending: false })
      .limit(100)
    
    if (data) {
      setNearbyIncidents(data)
    }
  }

  useEffect(() => {
    loadIncidents().finally(() => setLoading(false))
    
    // Subscribe to real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('incidents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        () => {
          loadIncidents()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadIncidents()
    setRefreshing(false)
  }

  const reportIncident = async () => {
    if (!newIncident.title || !coordinates) return
    
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
    })
    
    if (!error) {
      setNewIncident({
        title: '',
        description: '',
        incident_type: 'suspicious',
        severity: 'medium',
      })
      setShowReportDialog(false)
      loadIncidents()
    }

    if (!error && data) {
      // Disparar notificaciones push a usuarios cercanos
      await supabase.functions.invoke('notify-nearby-users', {
        body: {
          incident_id: data.id,
          incident_lat: coordinates.latitude,
          incident_lng: coordinates.longitude,
          title: newIncident.title,
          severity: newIncident.severity,
        }
      })
    }
  }

  const filteredIncidents = filterSeverity === 'all' 
    ? nearbyIncidents 
    : nearbyIncidents.filter(i => i.severity === filterSeverity)

  const incidentCounts = {
    high: nearbyIncidents.filter(i => i.severity === 'high').length,
    medium: nearbyIncidents.filter(i => i.severity === 'medium').length,
    low: nearbyIncidents.filter(i => i.severity === 'low').length,
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] pb-24">
      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden mb-4">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading incidents...</span>
            </div>
          </div>
        ) : (
          <IncidentMap
            incidents={filteredIncidents}
            userLocation={currentLocation || coordinates || null}
            showHeatZones={true}
          />
        )}
        
        {/* Map controls overlay */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="shadow-lg"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <p className="text-xs font-medium mb-2">Incident Severity</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-destructive" />
              <span>High ({incidentCounts.high})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-warning" />
              <span>Medium ({incidentCounts.medium})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span>Low ({incidentCounts.low})</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filter & Actions */}
      <div className="flex items-center gap-2 mb-4">
        <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as IncidentSeverity | 'all')}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Incidents</SelectItem>
            <SelectItem value="high">High Only</SelectItem>
            <SelectItem value="medium">Medium Only</SelectItem>
            <SelectItem value="low">Low Only</SelectItem>
          </SelectContent>
        </Select>
        
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Report Incident
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Report an Incident
              </DialogTitle>
              <DialogDescription>
                Help keep your community safe by reporting incidents in your area.
              </DialogDescription>
            </DialogHeader>
            
            <FieldGroup>
              <Field>
                <FieldLabel>What happened?</FieldLabel>
                <Input
                  placeholder="Brief description"
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                />
              </Field>
              
              <Field>
                <FieldLabel>Type of Incident</FieldLabel>
                <Select
                  value={newIncident.incident_type}
                  onValueChange={(v) => setNewIncident({ ...newIncident, incident_type: v as IncidentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              
              <Field>
                <FieldLabel>Severity</FieldLabel>
                <div className="flex gap-2">
                  {severityLevels.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setNewIncident({ ...newIncident, severity: level.value })}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        newIncident.severity === level.value
                          ? level.color
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </Field>
              
              <Field>
                <FieldLabel>Details (Optional)</FieldLabel>
                <Textarea
                  placeholder="Any additional details..."
                  rows={3}
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                />
              </Field>
              
              {coordinates && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Location will be recorded as:</p>
                  <p className="font-mono text-sm">
                    {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </FieldGroup>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={reportIncident} disabled={!newIncident.title || !coordinates}>
                Submit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Recent Incidents List */}
      <Card className="flex-shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Recent Nearby
            <Badge variant="secondary">{filteredIncidents.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[150px] overflow-y-auto space-y-2 pb-3">
          {filteredIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No incidents reported nearby
            </p>
          ) : (
            filteredIncidents.slice(0, 5).map((incident) => (
              <div key={incident.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ 
                    background: incident.severity === 'high' ? '#ef4444' 
                      : incident.severity === 'medium' ? '#f59e0b' 
                      : '#3b82f6'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(incident.reported_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
