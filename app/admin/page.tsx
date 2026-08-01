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
import { ShieldAlert, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

  // Carga inicial de datos y verificación de rol de administrador
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la base de datos
    const supabase = createClient()
    // Función para cargar los incidentes y verificar el rol del usuario
    const load = async () => {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      // Si no hay usuario, no hacer nada
      if (!user) { setLoading(false); return }
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

  // Si el usuario no es administrador, mostrar un mensaje de acceso restringido
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center mb-4">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-muted-foreground">Acceso restringido</p>
      </div>
    )
  }

  // Renderizar la lista de incidentes con opciones para verificar o eliminar cada uno
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Panel de Moderación</h1>
        {incidents.length === 0 ? (
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
        )}
      </div>
    </div>
  )
}
