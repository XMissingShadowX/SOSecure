//after-tab.tsx
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, MapPin, AlertTriangle, Lock, Key, Clock, Eye, EyeOff, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { sendAlarmNotification } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Incident } from '@/lib/types'


const SESSION_VOTED_KEY = 'safewalk_voted_incidents'

function getVotedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_VOTED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markVoted(id: string): void {
  const ids = getVotedIds()
  ids.add(id)
  sessionStorage.setItem(SESSION_VOTED_KEY, JSON.stringify([...ids]))
}

// Tipo para rastrear conteos de votos por incidente
type VoteCounts = Record<string, { real: number; fake: number }>

export function AfterTab() {
  const { nearbyIncidents, locationHistory, contacts } = useAppStore()
  const [incidentsToVerify, setIncidentsToVerify] = useState<Incident[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(() => getVotedIds())
  // Conteo de votos: { [incidentId]: { real: number, fake: number } }
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [securityPin, setSecurityPin] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pinSaved, setPinSaved] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [dangerZones, setDangerZones] = useState<{ lat: number; lng: number; count: number }[]>([])

  useEffect(() => {
    const loadUnverified = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('is_verified', false)
        .eq('is_active', true)
        .order('reported_at', { ascending: false })
        .limit(20)
      if (data) {
        const alreadyVoted = getVotedIds()
        setIncidentsToVerify(data.filter((inc) => !alreadyVoted.has(inc.id)))

        // Inicializar conteos desde los campos de la DB si existen,
        // o en 0 si la tabla no tiene esas columnas aún
        const counts: VoteCounts = {}
        for (const inc of data) {
          counts[inc.id] = {
            real: inc.votes_real ?? 0,
            fake: inc.votes_fake ?? 0,
          }
        }
        setVoteCounts(counts)
      }
    }
    loadUnverified()
  }, [])

  const [notifiedZoneCount, setNotifiedZoneCount] = useState(-1)

  useEffect(() => {
    const high = nearbyIncidents.filter(i => i.severity === 'high')
    const zones = high.reduce<{ lat: number; lng: number; count: number }[]>((acc, inc) => {
      const existing = acc.find(z => Math.abs(z.lat - inc.latitude) < 0.005 && Math.abs(z.lng - inc.longitude) < 0.005)
      if (existing) { existing.count++ } else { acc.push({ lat: inc.latitude, lng: inc.longitude, count: 1 }) }
      return acc
    }, [])
    setDangerZones(zones)

    // Solo notifica si el número de zonas cambió desde la última notificación
    if (zones.length > 0 && zones.length !== notifiedZoneCount) {
      sendAlarmNotification('⚠️ Zona de Peligro', `Hay ${zones.length} zona(s) de alerta cercanas`)
      setNotifiedZoneCount(zones.length)
    }
  }, [nearbyIncidents])

  const verifyIncident = async (incident: Incident, verified: boolean) => {
    if (votedIds.has(incident.id)) return

    // Optimistic update
    setVoteCounts(prev => ({
      ...prev,
      [incident.id]: {
        real: (prev[incident.id]?.real ?? 0) + (verified ? 1 : 0),
        fake: (prev[incident.id]?.fake ?? 0) + (verified ? 0 : 1),
      },
    }))
    markVoted(incident.id)
    setVotedIds(prev => new Set([...prev, incident.id]))
    setIncidentsToVerify(prev => prev.filter(i => i.id !== incident.id))

    const supabase = createClient()

    if (verified) {
      await supabase.rpc('increment_votes', {
        incident_id: incident.id,
        vote_column: 'votes_real',
      })
      // Marcar verificado aparte
      await supabase
        .from('incidents')
        .update({ is_verified: true })
        .eq('id', incident.id)
    } else {
      await supabase.rpc('increment_votes', {
        incident_id: incident.id,
        vote_column: 'votes_fake',
      })
      await supabase
        .from('incidents')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('id', incident.id)
    }
  }

  const savePin = () => {
    if (pinInput.length >= 4) {
      localStorage.setItem('safewalk_security_pin', pinInput)
      setSecurityPin(pinInput)
      setPinSaved(true)
      setPinInput('')
      setShowPinDialog(false)
    }
  }

  const checkPin = () => {
    const stored = localStorage.getItem('safewalk_security_pin')
    if (pinInput === stored) {
      setPinUnlocked(true)
      setPinInput('')
    } else {
      setPinInput('')
    }
  }

  const lastLocations = locationHistory.slice(-10)

  return (
    <div className="flex flex-col gap-6 pb-40">
      <Card className="border-safe/50 bg-safe/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-safe" />
          <div>
            <p className="font-semibold text-sm">Modo DESPUÉS</p>
            <p className="text-xs text-muted-foreground">Seguimiento y protección post-incidente</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone alerts */}
      {dangerZones.length > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Zona Peligrosa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dangerZones.map((zone, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg">
                <MapPin className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">{zone.count} incidente{zone.count > 1 ? 's' : ''} reportado{zone.count > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground font-mono">{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</p>
                </div>
                <Badge variant="destructive" className="ml-auto">Evitar</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Incident verification */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="w-5 h-5 text-primary" />
              Verificar Incidentes
            </CardTitle>
            <Badge variant="secondary" className="!text-black dark:!text-white">{incidentsToVerify.length} pendientes</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ayuda a verificar incidentes para evitar falsas alarmas en la comunidad.{' '}
            <span className="font-medium text-foreground">Solo puedes votar una vez por incidente en esta sesión.</span>
          </p>
          {incidentsToVerify.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle className="w-8 h-8 text-safe/60" />
              <p className="text-sm text-muted-foreground">
                {votedIds.size > 0
                  ? `Ya votaste en ${votedIds.size} incidente${votedIds.size > 1 ? 's' : ''} esta sesión. ¡Gracias!`
                  : 'Sin incidentes pendientes de verificación'}
              </p>
            </div>
          ) : (
            incidentsToVerify.slice(0, 5).map((inc) => {
              const alreadyVoted = votedIds.has(inc.id)
              const counts = voteCounts[inc.id] ?? { real: 0, fake: 0 }
              const totalVotes = counts.real + counts.fake

              return (
                <div
                  key={inc.id}
                  className={`p-3 rounded-lg space-y-2 transition-opacity ${alreadyVoted ? 'opacity-50 bg-muted/30' : 'bg-muted/50'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: inc.severity === 'high' ? '#ef4444' : inc.severity === 'medium' ? '#f59e0b' : '#3b82f6' }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{inc.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inc.reported_at).toLocaleString()}</p>
                    </div>
                    {alreadyVoted && (
                      <Badge variant="secondary" className="text-xs shrink-0">Ya votado</Badge>
                    )}
                  </div>

                  {/* Badges de conteo de votos */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}:
                    </span>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-xs border-green-500/50 text-green-600 dark:text-green-400 px-2 py-0.5"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {counts.real} real
                    </Badge>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-xs border-red-400/50 text-red-500 dark:text-red-400 px-2 py-0.5"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      {counts.fake} falso
                    </Badge>
                  </div>

                  {alreadyVoted ? (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Ya enviaste tu voto sobre este incidente esta sesión
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-safe border-safe hover:bg-safe/10"
                        onClick={() => verifyIncident(inc, true)}
                      >
                        ✓ Real
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => verifyIncident(inc, false)}
                      >
                        ✗ Falso
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Location history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5 text-primary" />
            Historial de Ubicación (Anti-secuestro)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pinSaved && !pinUnlocked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ingresa tu PIN de seguridad para ver el historial</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    placeholder="PIN de seguridad"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    maxLength={6}
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPin(!showPin)}>
                    {showPin ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
                <Button onClick={checkPin}>Ver</Button>
              </div>
            </div>
          ) : (
            <>
              {lastLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay historial de ubicación aún</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lastLocations.map((loc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                      <span className="text-muted-foreground">
                        {new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="font-mono">{loc.coordinates.latitude.toFixed(5)}, {loc.coordinates.longitude.toFixed(5)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Se guardan las últimas ubicaciones de los últimos 10 minutos para compartir con autoridades
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security PIN */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-5 h-5 text-primary" />
            PIN de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Protege el acceso al historial de ubicación y datos sensibles con un PIN personal.
          </p>
          <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Lock className="w-4 h-4 mr-2" />
                {pinSaved ? 'Cambiar PIN' : 'Configurar PIN'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar PIN de Seguridad</DialogTitle>
                <DialogDescription>
                  Este PIN protege el acceso a tu historial de ubicación y datos de emergencia. Mínimo 4 dígitos.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>Nuevo PIN (4-6 dígitos)</FieldLabel>
                  <div className="relative">
                    <Input
                      type={showPin ? 'text' : 'password'}
                      placeholder="••••"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPin(!showPin)}>
                      {showPin ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowPinDialog(false); setPinInput('') }}>Cancelar</Button>
                <Button onClick={savePin} disabled={pinInput.length < 4}>Guardar PIN</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {pinUnlocked && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setPinUnlocked(false)}>
              <Lock className="w-4 h-4 mr-2" />
              Bloquear acceso
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Contact access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acceso de Contactos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Contactos que pueden solicitar ver tu historial de ubicación:
          </p>
          <div className="flex flex-wrap gap-2">
            {contacts.filter(c => c.importance === 'primary').map(c => (
              <Badge key={c.id} className="bg-primary/20 text-primary">{c.name}</Badge>
            ))}
            {contacts.filter(c => c.importance === 'primary').length === 0 && (
              <p className="text-xs text-muted-foreground">Marca contactos como &quot;Principal&quot; para darles acceso</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}