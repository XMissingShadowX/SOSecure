'use client'

import { useEffect, useState } from 'react'
import { Shield, MapPin, Users, Plus, Trash2, AlertCircle, Star, Home, Briefcase, BookOpen, Heart, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import type { EmergencyContact, FrequentPlace } from '@/lib/types'

const MAX_CONTACTS = 10

const importanceLevels: { value: EmergencyContact['importance']; label: string; color: string }[] = [
  { value: 'primary', label: 'Principal', color: 'bg-destructive text-destructive-foreground' },
  { value: 'secondary', label: 'Secundario', color: 'bg-warning text-warning-foreground' },
  { value: 'tertiary', label: 'Terciario', color: 'bg-primary text-primary-foreground' },
]

const placeTypes = [
  { value: 'home', label: 'Casa', icon: Home },
  { value: 'work', label: 'Trabajo', icon: Briefcase },
  { value: 'school', label: 'Escuela', icon: BookOpen },
  { value: 'gym', label: 'Gimnasio', icon: Heart },
  { value: 'other', label: 'Otro', icon: Star },
]

const placeIcons: Record<string, React.ElementType> = {
  home: Home, work: Briefcase, school: BookOpen, gym: Heart, other: Star,
}

export function HomeTab() {
  const { coordinates, loading: locationLoading, error: locationError } = useGeolocation({ watch: true })
  const { setCurrentLocation, contacts, setContacts, nearbyIncidents, frequentPlaces, addFrequentPlace, removeFrequentPlace } = useAppStore()
  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: '',
    importance: 'secondary' as EmergencyContact['importance']
  })
  const [newPlace, setNewPlace] = useState<{ label: string; type: string; address: string; lat?: string; lon?: string }>({ label: '', type: 'home', address: '' })
  const [placeSuggestions, setPlaceSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (coordinates) {
      setCurrentLocation(coordinates)
    }
  }, [coordinates, setCurrentLocation])

  useEffect(() => {
    async function loadContacts() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('priority')
        if (data) setContacts(data)
      }
      setLoading(false)
    }
    loadContacts()
  }, [setContacts])

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) return
    if (contacts.length >= MAX_CONTACTS) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: user.id,
          name: newContact.name,
          phone: newContact.phone,
          email: newContact.email || null,
          relationship: newContact.relationship || null,
          priority: contacts.length + 1,
          importance: newContact.importance,
        })
        .select()
        .single()
      if (data && !error) {
        setContacts([...contacts, data])
        setNewContact({ name: '', phone: '', email: '', relationship: '', importance: 'secondary'})
        setShowAddContact(false)
      }
    }
  }

  const removeContact = async (contact: EmergencyContact) => {
    const supabase = createClient()
    await supabase.from('emergency_contacts').delete().eq('id', contact.id)
    setContacts(contacts.filter(c => c.id !== contact.id))
  }

  const addPlace = async () => {
    if (!newPlace.label || !coordinates) return

    let placeCoordinates = coordinates

    if (newPlace.lat && newPlace.lon) {
      placeCoordinates = {
        latitude: parseFloat(newPlace.lat),
        longitude: parseFloat(newPlace.lon),
      }
    }

    const place: FrequentPlace = {
      id: Date.now().toString(),
      label: newPlace.label,
      icon: newPlace.type,
      address: newPlace.address || `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
      coordinates: placeCoordinates,
    }
    addFrequentPlace(place)
    setNewPlace({ label: '', type: 'home', address: '' })
    setPlaceSuggestions([])
    setShowAddPlace(false)
  }

  const nearbyDangerCount = nearbyIncidents.filter(i => i.severity === 'high').length
  const importanceColor = (importance: string) => {
    if (importance === 'primary') return 'bg-destructive/20 text-destructive'
    if (importance === 'secondary') return 'bg-warning/20 text-warning'
    return 'bg-primary/20 text-primary'
  }

  return (
    <div className="flex flex-col gap-6 pb-40">
      {/* Status Banner */}
      <Card className={cn("border-2", nearbyDangerCount > 0 ? "border-warning bg-warning/10" : "border-safe bg-safe/10")}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className={cn("p-3 rounded-full", nearbyDangerCount > 0 ? "bg-warning/20" : "bg-safe/20")}>
            <Shield className={cn("w-8 h-8", nearbyDangerCount > 0 ? "text-warning" : "text-safe")} />
          </div>
          <div className="flex-1">
            <h2 className={cn("font-semibold text-lg", nearbyDangerCount > 0 ? "text-warning" : "text-safe")}>
              {nearbyDangerCount > 0 ? `${nearbyDangerCount} Alerta${nearbyDangerCount > 1 ? 's' : ''} Cercana${nearbyDangerCount > 1 ? 's' : ''}` : 'Zona Aparentemente Segura'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locationLoading ? 'Obteniendo ubicación...'
                : locationError ? locationError
                : coordinates ? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`
                : 'Activa la ubicación para usar las funciones de seguridad'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ubicación Actual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5 text-primary" />
            Ubicación Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locationLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Adquiriendo GPS...</span>
            </div>
          ) : locationError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>{locationError}</span>
            </div>
          ) : coordinates ? (
            <div className="space-y-2 bg-muted">
              <p className="font-mono text-sm bg-muted px-3 py-2 rounded">
                {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </p>
              <p className="text-xs text-muted-foreground">Tu ubicación se monitorea para funciones de seguridad</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Ubicación no disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Lugares Frecuentes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Navigation className="w-5 h-5 text-primary" />
              Lugares Frecuentes
            </CardTitle>
            <span className="text-sm text-muted-foreground">{frequentPlaces.length} guardados</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {frequentPlaces.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Agrega lugares frecuentes para acceder rápido a ellos
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {frequentPlaces.map((place) => {
                const Icon = placeIcons[place.icon] || Star
                return (
                  <div key={place.id} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{place.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                    <button onClick={() => removeFrequentPlace(place.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <Dialog open={showAddPlace} onOpenChange={setShowAddPlace}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar lugar frecuente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Lugar Frecuente</DialogTitle>
                <DialogDescription>Busca una dirección o usa tu ubicación actual.</DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>Tipo de lugar</FieldLabel>
                  <Select value={newPlace.type} onValueChange={(v) => setNewPlace({ ...newPlace, type: v, label: placeTypes.find(p => p.value === v)?.label || v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {placeTypes.map(pt => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Nombre</FieldLabel>
                  <Input placeholder="Ej. Casa de mamá" value={newPlace.label} onChange={(e) => setNewPlace({ ...newPlace, label: e.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>Dirección (opcional)</FieldLabel>
                  <div className="relative">
                    <Input
                      placeholder="Busca una dirección..."
                      value={newPlace.address}
                      onChange={async (e) => {
                        const value = e.target.value
                        setNewPlace({ ...newPlace, address: value, lat: undefined, lon: undefined })
                        if (value.length < 3) { setPlaceSuggestions([]); return }
                        clearTimeout((window as any)._placeTimeout)
                        ;(window as any)._placeTimeout = setTimeout(async () => {
                          try {
                            const res = await fetch(
                              `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`,
                              { headers: { 'Accept': 'application/json' } }
                            )
                            const data = await res.json()
                            setPlaceSuggestions(data.features.map((f: any) => ({
                              display_name: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', '),
                              lat: f.geometry.coordinates[1].toString(),
                              lon: f.geometry.coordinates[0].toString(),
                            })))
                          } catch {}
                        }, 500)
                      }}
                    />
                    {placeSuggestions.length > 0 && (
                      <div className="absolute top-10 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {placeSuggestions.map((s, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted-foreground border-b border-border last:border-0"
                            onClick={() => {
                              setNewPlace({ ...newPlace, address: s.display_name, lat: s.lat, lon: s.lon })
                              setPlaceSuggestions([])
                            }}
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                {coordinates && !newPlace.lat && (
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    📍 Sin dirección seleccionada se usará tu ubicación actual: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                  </div>
                )}
                {newPlace.lat && (
                  <div className="p-3 bg-safe/10 rounded-lg text-xs text-safe">
                    ✓ Dirección geocodificada correctamente
                  </div>
                )}
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowAddPlace(false); setPlaceSuggestions([]) }}>Cancelar</Button>
                <Button onClick={addPlace} disabled={!newPlace.label || !coordinates}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Contactos de Emergencia */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-primary" />
              Contactos de Emergencia
            </CardTitle>
            <span className="text-sm text-muted-foreground">{contacts.length}/{MAX_CONTACTS}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Cargando contactos...</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-3">Sin contactos de emergencia</p>
              <p className="text-sm text-muted-foreground">Agrega hasta {MAX_CONTACTS} contactos</p>
            </div>
          ) : (
            <div className="space-y-2 bg-muted">
              {contacts.map((contact, index) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contact.name}</p>
                        <Badge className={cn('text-xs px-1.5 py-0', importanceColor(contact.importance || 'secondary'))}>
                          {importanceLevels.find(i => i.value === (contact.importance || 'secondary'))?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      {contact.relationship && <p className="text-xs text-muted-foreground">{contact.relationship}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeContact(contact)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {contacts.length < MAX_CONTACTS && (
            <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Contacto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Contacto de Emergencia</DialogTitle>
                  <DialogDescription>Esta persona será notificada durante una alerta SOS.</DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nombre</FieldLabel>
                    <Input placeholder="Nombre del contacto" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Teléfono</FieldLabel>
                    <Input type="tel" placeholder="+52 555 000 0000" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Email (para alertas automáticas)</FieldLabel>
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={newContact.email || ''}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Relación (Opcional)</FieldLabel>
                    <Select value={newContact.relationship} onValueChange={(v) => setNewContact({ ...newContact, relationship: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona relación" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Padre/Madre</SelectItem>
                        <SelectItem value="spouse">Esposo/a</SelectItem>
                        <SelectItem value="sibling">Hermano/a</SelectItem>
                        <SelectItem value="friend">Amigo/a</SelectItem>
                        <SelectItem value="partner">Pareja</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Importancia</FieldLabel>
                    <div className="flex gap-2">
                      {importanceLevels.map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setNewContact({ ...newContact, importance: level.value })}
                          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                            newContact.importance === level.value ? level.color : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancelar</Button>
                  <Button onClick={addContact} disabled={!newContact.name || !newContact.phone}>Agregar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Consejos de Seguridad */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consejos de Seguridad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { n: 1, bold: 'Mantén presionado SOS 2 segundos', rest: ' para activar el modo de emergencia' },
            { n: 2, bold: 'Revisa el mapa', rest: ' para ver incidentes reportados cerca de ti' },
            { n: 3, bold: 'Usa el temporizador de seguridad', rest: ' si sales a un lugar desconocido' },
          ].map(t => (
            <div key={t.n} className="flex items-start gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary font-semibold text-xs">{t.n}</span>
              </div>
              <p className="text-muted-foreground"><strong className="text-foreground">{t.bold}</strong>{t.rest}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}