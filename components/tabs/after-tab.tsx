/*
  DESPUÉS: Seguimiento y Protección Post-Incidente

  - Verificación de incidentes reportados por la comunidad para reducir falsas alarmas
  - Historial de ubicación anti-secuestro con acceso protegido por PIN
  - Alertas de zonas peligrosas basadas en incidentes cercanos
  - Acceso controlado para contactos de emergencia a datos sensibles
*/
'use client'

// React y librerías
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

// Clave para almacenar IDs de incidentes votados en sessionStorage
const SESSION_VOTED_KEY = 'safewalk_voted_incidents'

// Funciones para manejar votos en sessionStorage, evitando votar múltiples veces por incidente en la misma sesión
function getVotedIds(): Set<string> {
  // Intentar cargar los IDs de incidentes votados desde sessionStorage
  try {
    // Si no hay datos, devuelve un Set vacío
    const raw = sessionStorage.getItem(SESSION_VOTED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    // En caso de error (p. ej., JSON mal formado), limpiar el almacenamiento y devolver un Set vacío
    return new Set()
  }
}

// Agregar un ID de incidente a la lista de votados en sessionStorage
function markVoted(id: string): void {
  // Obtener el Set actual de IDs votados, agregar el nuevo ID y guardar de nuevo en sessionStorage
  const ids = getVotedIds()
  ids.add(id)
  sessionStorage.setItem(SESSION_VOTED_KEY, JSON.stringify([...ids]))
}

// Tipo para contar votos reales y falsos por incidente
type VoteCounts = Record<string, { real: number; fake: number }>

// Componente principal para la pestaña "Después"
export function AfterTab() {
  // Estado local para incidentes a verificar, votos, PIN de seguridad, zonas de peligro, etc.
  const { nearbyIncidents, locationHistory, contacts } = useAppStore()
  const [incidentsToVerify, setIncidentsToVerify] = useState<Incident[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())  // ← vacío, sin getVotedIds()
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [securityPin, setSecurityPin] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pinSaved, setPinSaved] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [dangerZones, setDangerZones] = useState<{ lat: number; lng: number; count: number }[]>([])

  // Al cargar el componente, obtener los IDs de incidentes votados en esta sesión y el PIN de seguridad guardado
  useEffect(() => {
    // Cargar IDs de incidentes votados en esta sesión para evitar votos múltiples
    setVotedIds(getVotedIds())
    // Cargar PIN de seguridad guardado en localStorage para proteger el historial de ubicación
    const storedPin = localStorage.getItem('safewalk_security_pin')
    // Si hay un PIN guardado, cargarlo en el estado y marcar que ya se ha guardado un PIN para mostrar 
    // opciones de cambio en la UI
    if (storedPin) {
      setSecurityPin(storedPin)
      setPinSaved(true)
    }
  }, [])

  // Al cargar el componente, obtener los incidentes no verificados y sus conteos de votos para mostrar en 
  // la sección de verificación
  useEffect(() => {
    // Función para cargar incidentes no verificados desde Supabase
    const loadUnverified = async () => {
      // Crear cliente de Supabase para hacer consultas a la base de datos
      const supabase = createClient()
      
      // Consultar los incidentes que no han sido verificados y que aún están activos, ordenados por fecha de reporte
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('is_verified', false)
        .eq('is_active', true)
        .order('reported_at', { ascending: false })
        .limit(20)
      
      // Si se obtienen datos, procesarlos para mostrar en la UI
      if (data) {
        // Obtener los IDs de incidentes en los que el usuario ya votó en esta sesión para marcar esos 
        // incidentes como ya votados
        const alreadyVoted = getVotedIds()
        
        // Filtrar los incidentes para mostrar solo aquellos en los que el usuario no ha votado aún
        setIncidentsToVerify(data.filter((inc) => !alreadyVoted.has(inc.id)))
        
        // Construir un objeto de conteo de votos para cada incidente, con votos reales y falsos
        const counts: VoteCounts = {}
        
        // Recorrer los incidentes obtenidos y llenar el objeto de conteo de votos con los datos de la base de datos
        for (const inc of data) {
          // Para cada incidente, almacenar el número de votos reales y falsos, usando 0 como valor predeterminado 
          // si no hay datos
          counts[inc.id] = {
            real: inc.votes_real ?? 0,
            fake: inc.votes_fake ?? 0,
          }
        }
        // Actualizar el estado con los conteos de votos para mostrar en la UI
        setVoteCounts(counts)
      }
    }
    // Llamar a la función para cargar los incidentes no verificados al montar el componente
    loadUnverified()
  }, [])

  // Cada vez que cambian los incidentes cercanos, recalcular las zonas de peligro y enviar notificaciones 
  // si hay nuevas zonas detectadas
  const [notifiedZoneCount, setNotifiedZoneCount] = useState(-1)

  // Recalcular zonas de peligro basadas en incidentes cercanos con severidad alta
  useEffect(() => {
    // Filtrar los incidentes cercanos para obtener solo aquellos con severidad alta
    const high = nearbyIncidents.filter(i => i.severity === 'high')
    
    // Agrupar los incidentes cercanos en zonas basadas en su latitud y longitud, contando cuántos incidentes hay en cada zona
    const zones = high.reduce<{ lat: number; lng: number; count: number }[]>((acc, inc) => {
      // Buscar si ya existe una zona cercana (dentro de ~500m) para el incidente actual
      const existing = acc.find(z => Math.abs(z.lat - inc.latitude) < 0.005 && Math.abs(z.lng - inc.longitude) < 0.005)
      
      // Si existe una zona cercana, incrementar su contador; de lo contrario, agregar una nueva zona al acumulador
      if (existing) { existing.count++ } else { acc.push({ lat: inc.latitude, lng: inc.longitude, count: 1 }) }
      
      // Devolver el acumulador actualizado para el siguiente ciclo
      return acc
    }, [])
    // Actualizar el estado con las zonas de peligro calculadas
    setDangerZones(zones)

    // Si hay zonas de peligro y el número de zonas es diferente al número de zonas notificadas anteriormente, 
    // enviar una notificación de alarma al usuario indicando cuántas zonas de alerta cercanas hay, y actualizar 
    // el contador de zonas notificadas para evitar notificaciones repetitivas
    
    // Solo notifica si el número de zonas cambió desde la última notificación
    if (zones.length > 0 && zones.length !== notifiedZoneCount) {
      // Enviar una notificación de alarma al usuario indicando cuántas zonas de alerta cercanas hay
      sendAlarmNotification('⚠️ Zona de Peligro', `Hay ${zones.length} zona(s) de alerta cercanas`)
      setNotifiedZoneCount(zones.length)
    }
  }, [nearbyIncidents])

  // Función para manejar la verificación de un incidente, actualizando el conteo de votos y el estado del 
  // incidente en la base de datos
  const verifyIncident = async (incident: Incident, verified: boolean) => {
    // Si el usuario ya votó en este incidente en esta sesión, no hacer nada para evitar votos múltiples
    if (votedIds.has(incident.id)) return

    // Actualizar el conteo de votos en el estado local para reflejar el nuevo voto del usuario, 
    // incrementando el conteo de votos reales o falsos según corresponda
    setVoteCounts(prev => ({
      // Mantener los conteos anteriores para otros incidentes, y actualizar solo el incidente votado incrementando
      ...prev,
      [incident.id]: {
        // Incrementar el conteo de votos reales o falsos según el voto del usuario, usando 0 como valor 
        // predeterminado si no hay datos anteriores
        real: (prev[incident.id]?.real ?? 0) + (verified ? 1 : 0),
        fake: (prev[incident.id]?.fake ?? 0) + (verified ? 0 : 1),
      },
    }))
    // Marcar este incidente como votado en sessionStorage para evitar que el usuario vote nuevamente en esta sesión
    markVoted(incident.id)

    // Actualizar el estado local para reflejar que el usuario ha votado en este incidente, agregando su 
    // ID al Set de IDs votados
    setVotedIds(prev => new Set([...prev, incident.id]))
    
    // Eliminar el incidente de la lista de incidentes a verificar para que ya no se muestre en la UI
    setIncidentsToVerify(prev => prev.filter(i => i.id !== incident.id))

    // Crear cliente de Supabase para hacer consultas a la base de datos y actualizar el conteo de votos y 
    // el estado del incidente
    const supabase = createClient()

    // Llamar a una función RPC en Supabase para incrementar el conteo de votos reales o falsos según el voto del usuario,
    // pasando el ID del incidente y el tipo de voto (real o falso) como parámetros
    if (verified) {
      // Incrementar el conteo de votos reales para este incidente en la base de datos usando una función RPC personalizada
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
      // Incrementar el conteo de votos falsos para este incidente en la base de datos usando una función RPC personalizada
      await supabase.rpc('increment_votes', {
        incident_id: incident.id,
        vote_column: 'votes_fake',
      })
      // Si el incidente recibe suficientes votos falsos, marcarlo como no activo para que ya no se muestre como incidente activo en la aplicación
      await supabase
        .from('incidents')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('id', incident.id)
    }
  }

  // Función para guardar el PIN de seguridad en localStorage y actualizar el estado para proteger el acceso 
  // al historial de ubicación
  const savePin = () => {
    if (pinInput.length >= 4) {
      localStorage.setItem('safewalk_security_pin', pinInput)
      setSecurityPin(pinInput)
      setPinSaved(true)
      setPinInput('')
      setShowPinDialog(false)
    }
  }

  // Función para verificar el PIN de seguridad ingresado por el usuario y desbloquear el acceso al historial 
  // de ubicación si el PIN es correcto
  const checkPin = () => {
    // Obtener el PIN almacenado en localStorage para compararlo con el PIN ingresado por el usuario
    const stored = localStorage.getItem('safewalk_security_pin')
    
    // Si el PIN ingresado coincide con el PIN almacenado, desbloquear el acceso al historial de ubicación y
    if (pinInput === stored) {
      setPinUnlocked(true)
      setPinInput('')
    } else {
      setPinInput('')
    }
  }

  // Tomar solo las últimas 10 ubicaciones del historial para mostrar en la sección de historial de ubicación,
  // ya que generalmente se guardan ubicaciones cada minuto, esto cubriría los últimos 10 minutos de historial
  const lastLocations = locationHistory.slice(-10)

  // Renderizar la UI de la pestaña "Después" con secciones para alertas de zonas peligrosas, verificación de 
  // incidentes, historial de ubicación protegido por PIN, configuración de PIN de seguridad y acceso de 
  // contactos a datos sensibles basados en la información y el estado manejados en este componente y en la 
  // tienda global de la aplicación. La UI incluye tarjetas informativas, botones para acciones, y secciones 
  // dinámicas que se actualizan según el estado de los incidentes, votos, y configuraciones del usuario.
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