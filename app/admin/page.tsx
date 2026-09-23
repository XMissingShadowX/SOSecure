/*
  AdminPage.tsx - Panel de Moderación para Incidentes Reportados
  - Muestra una lista de incidentes reportados con detalles como título, tipo, severidad, fecha y nombre del reportante.
  - Permite a los administradores verificar o eliminar incidentes directamente desde la interfaz.
  - Utiliza Supabase para autenticación y gestión de datos.

  Requisitos:
  - Solo accesible para usuarios con rol de administrador.
  - Listado ordenado por fecha de reporte, mostrando los más recientes primero.
  - Botones de acción para verificar o eliminar incidentes, actualizando la base de datos en consecuencia.

  Nota: Asegúrate de tener la función RPC 'is_admin' implementada en tu base de datos Supabase para verificar
  el rol del usuario.
*/

// Indicar que este componente se ejecuta en el cliente para poder usar hooks de React
'use client'
// Importar hooks de React y la función para crear un cliente de Supabase
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldAlert, Trash2, Loader2, Mail, MailOpen, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'

// Ticket de soporte/contacto (correos entrantes a soporte@/contacto@ vía Resend
// Inbound → /api/inbound). Ver supabase/migrations/20240017_support_tickets.sql.
interface SupportTicket {
  id: string
  from_address: string
  to_address: string
  subject: string | null
  text_body: string | null
  html_body: string | null
  status: 'open' | 'closed'
  received_at: string
}

// Definir la interfaz para los incidentes, incluyendo los campos relevantes y la relación con el perfil del reportante
interface Incident {
  // Campos del incidente
  id: string
  title: string
  incident_type: string
  severity: string
  reported_at: string
  is_active: boolean
  profiles?: { full_name: string }
}

// Estilos de Badge por severidad, reutilizando los mismos tokens semánticos que el mapa de incidentes (map-tab.tsx)
const severityStyles: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-warning text-warning-foreground',
  low: 'bg-safe text-safe-foreground',
}

// Componente principal del panel de administración
export default function AdminPage() {
  // Estado para almacenar los incidentes, verificar si el usuario es administrador, y la carga inicial
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Sesión: se distingue de isAdmin porque "sin sesión" (mostrar login) y
  // "con sesión pero sin rol admin" (mostrar acceso restringido) son dos
  // pantallas distintas.
  const [hasSession, setHasSession] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // Sección de Contacto (tickets de soporte@/contacto@)
  const [tab, setTab] = useState<'incidents' | 'contact'>('incidents')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  // Carga inicial de datos y verificación de rol de administrador
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la base de datos
    const supabase = createClient()
    // Función para cargar los incidentes y verificar el rol del usuario
    const load = async () => {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      // Si no hay usuario, mostrar el formulario de login en vez de seguir
      if (!user) { setHasSession(false); setLoading(false); return }
      setHasSession(true)
      // Verificar si el usuario es administrador utilizando una función RPC personalizada
      const { data: adminCheck } = await supabase.rpc('is_admin', { uid: user.id })
      // Actualizar el estado de isAdmin basado en el resultado de la verificación
      setIsAdmin(!!adminCheck)
      // Si el usuario es administrador, cargar los incidentes reportados
      if (adminCheck) {
        const { data } = await supabase
          // Seleccionar todos los incidentes junto con el nombre completo del perfil asociado, ordenados por fecha de reporte
          .from('incidents')
          .select('*, profiles(full_name)')
          .order('reported_at', { ascending: false })
          // Filtrar solo los incidentes activos
          .eq('is_active', true)
        setIncidents(data ?? [])
      }
      setLoading(false)
    }

    // Llamar a la función de carga al montar el componente
    load()
  }, [])

  // Cargar tickets de contacto solo cuando se entra a esa pestaña siendo admin
  // (evita pegarle a /api/admin/support-tickets si el usuario nunca la abre)
  useEffect(() => {
    if (!isAdmin || tab !== 'contact') return
    setTicketsLoading(true)
    fetch('/api/admin/support-tickets')
      .then(res => res.json())
      .then(data => setTickets(data.tickets ?? []))
      .finally(() => setTicketsLoading(false))
  }, [isAdmin, tab])

  const toggleTicketStatus = async (ticket: SupportTicket) => {
    const nextStatus = ticket.status === 'open' ? 'closed' : 'open'
    const res = await fetch('/api/admin/support-tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticket.id, status: nextStatus }),
    })
    if (res.ok) {
      setTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status: nextStatus } : t)))
    }
  }

  // Reintenta la carga completa (sesión + rol + incidentes) tras un login exitoso,
  // reutilizando la misma lógica del useEffect inicial.
  const reload = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHasSession(false); setLoading(false); return }
    setHasSession(true)
    const { data: adminCheck } = await supabase.rpc('is_admin', { uid: user.id })
    setIsAdmin(!!adminCheck)
    if (adminCheck) {
      const { data } = await supabase
        .from('incidents')
        .select('*, profiles(full_name)')
        .order('reported_at', { ascending: false })
        .eq('is_active', true)
      setIncidents(data ?? [])
    }
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoginLoading(false)
    if (error) { setLoginError(error.message); return }
    setLoginPassword('')
    await reload()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setHasSession(false)
    setIsAdmin(false)
    setIncidents([])
    setTickets([])
  }

  // Función para desactivar (eliminar) un incidente
  const deactivate = async (id: string) => {
    // Crear una instancia de Supabase para interactuar con la base de datos
    const supabase = createClient()
    // Actualizar el incidente para marcarlo como inactivo en la base de datos
    await supabase.from('incidents').update({ is_active: false }).eq('id', id)
    // Actualizar el estado local para eliminar el incidente de la lista visible
    setIncidents(prev => prev.filter(i => i.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  // Sin sesión: mostrar formulario de login en vez de pedirlo en /auth/login,
  // para no perder el destino /admin en el camino (esta ruta no la usan
  // usuarios normales, así que no hay razón para reusar esa pantalla completa).
  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Panel de administración</CardTitle>
              <CardDescription>Inicia sesión con tu cuenta de administrador</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <FieldGroup>
                  {loginError && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}
                  <Field>
                    <FieldLabel>Correo</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Mail className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel>Contraseña</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </InputGroup>
                  </Field>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    <LogIn className="w-4 h-4" /> {loginLoading ? 'Ingresando…' : 'Ingresar'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Con sesión pero sin rol admin/moderator, mostrar un mensaje de acceso restringido
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center mb-4">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-muted-foreground">Acceso restringido</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={handleLogout}>
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </Button>
      </div>
    )
  }

  // Renderizar la lista de incidentes con opciones para verificar o eliminar cada uno
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Panel de Moderación</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </Button>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('incidents')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'incidents' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            Incidentes
          </button>
          <button
            onClick={() => setTab('contact')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'contact' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            Contacto
          </button>
        </div>

        {tab === 'incidents' && (
          incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay incidentes activos.</p>
          ) : (
            <div className="space-y-3">
              {incidents.map(inc => (
                <Card key={inc.id}>
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{inc.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={severityStyles[inc.severity] ?? ''}>{inc.severity}</Badge>
                        <span className="text-sm text-muted-foreground truncate">{inc.incident_type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 truncate">
                        {new Date(inc.reported_at).toLocaleString()} · {inc.profiles?.full_name ?? 'Anónimo'}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deactivate(inc.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'contact' && (
          ticketsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay mensajes de contacto.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => {
                const expanded = expandedTicket === ticket.id
                return (
                  <Card key={ticket.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setExpandedTicket(expanded ? null : ticket.id)}
                        >
                          <p className="font-medium truncate">{ticket.subject || '(sin asunto)'}</p>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {ticket.from_address} → {ticket.to_address}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {new Date(ticket.received_at).toLocaleString()}
                          </p>
                        </button>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge className={ticket.status === 'open' ? 'bg-warning text-warning-foreground' : 'bg-safe text-safe-foreground'}>
                            {ticket.status === 'open' ? 'Abierto' : 'Cerrado'}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => toggleTicketStatus(ticket)}>
                            {ticket.status === 'open' ? (
                              <><MailOpen className="w-3.5 h-3.5" /> Cerrar</>
                            ) : (
                              <><Mail className="w-3.5 h-3.5" /> Reabrir</>
                            )}
                          </Button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-3 pt-3 border-t text-sm whitespace-pre-wrap break-words">
                          {ticket.text_body || 'Sin contenido de texto disponible.'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
