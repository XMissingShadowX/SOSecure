/*
  Este archivo define la página de callback de autenticación para la aplicación.
  Después de que el usuario inicie sesión con Supabase, será redirigido a esta página,
  donde se verificará la sesión y luego se redirigirá al usuario a la página principal.

  Nota: Asegúrate de configurar correctamente las URL de redirección en tu proyecto de Supabase
  para que apunten a esta página después del inicio de sesión.
*/

'use client'
// Importar hooks de React y la función para crear un cliente de Supabase
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/// Este componente se encarga de manejar el callback de autenticación
export default function AuthCallbackPage() {
  // Obtener el router para redirigir al usuario después de verificar la sesión
  const router = useRouter()

  // Verificar la sesión del usuario al montar el componente
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la autenticación
    const supabase = createClient()

    const run = async () => {
      // Igual que en app/page.tsx: solo confirmar el reset de PIN pendiente
      // si `exchangeCodeForSession` realmente valida el código del Magic
      // Link — una sesión ya existente (ambiente) NO es prueba de que el
      // link se haya usado.
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          await fetch('/api/pin/finalize-reset', { method: 'POST' }).catch(() => {})
        }
      }
      // Redirigir al usuario a la página principal después de verificar la sesión
      router.push('/')
    }
    run()
  }, [router])

  // Mostrar un mensaje de verificación mientras se verifica la sesión del usuario
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Verificando sesión...</p>
    </div>
  )
}
