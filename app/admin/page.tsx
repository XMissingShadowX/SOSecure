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

// Componente principal del panel de administración
export default function AdminPage() {
  // Estado para almacenar los incidentes y verificar si el usuario es administrador
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  // Carga inicial de datos y verificación de rol de administrador
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la base de datos
    const supabase = createClient()
    // Función para cargar los incidentes y verificar el rol del usuario
    const load = async () => {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      // Si no hay usuario, no hacer nada
      if (!user) return
      // Verificar si el usuario es administrador utilizando una función RPC personalizada
      const { data: adminCheck } = await supabase.rpc('is_admin', { uid: user.id })
      // Actualizar el estado de isAdmin basado en el resultado de la verificación
      setIsAdmin(!!adminCheck)
      // Si el usuario es administrador, cargar los incidentes reportados
      const { data } = await supabase
        // Seleccionar todos los incidentes junto con el nombre completo del perfil asociado, ordenados por fecha de reporte
        .from('incidents')
        .select('*, profiles(full_name)')
        .order('reported_at', { ascending: false })
        // Filtrar solo los incidentes activos
        .eq('is_active', true)
      setIncidents(data ?? [])
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

  // Si el usuario no es administrador, mostrar un mensaje de acceso restringido
  if (!isAdmin) return <p className="p-8 text-center">Acceso restringido</p>

  // Renderizar la lista de incidentes con opciones para verificar o eliminar cada uno
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Panel de Moderación</h1>
      {incidents.map(inc => (
        <div key={inc.id} className="border rounded-lg p-4 mb-3 flex justify-between items-start">
          <div>
            <p className="font-medium">{inc.title}</p>
            <p className="text-sm text-muted-foreground">{inc.incident_type} · {inc.severity}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(inc.reported_at).toLocaleString()} · {inc.profiles?.full_name ?? 'Anónimo'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => deactivate(inc.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded">✕ Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  )
}
