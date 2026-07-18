/*
  Este archivo define la página principal de la aplicación SOSecure.
  Aquí se verifica si el usuario está autenticado y se muestra la interfaz principal de la aplicación o una 
  pantalla de bienvenida con opciones para iniciar sesión o registrarse.

  Nota: Asegúrate de que las rutas de autenticación (login, sign-up) estén correctamente configuradas en tu proyecto para 
  que los enlaces funcionen correctamente.
*/

'use client'
// Importar hooks de React, la función para crear un cliente de Supabase, componentes de UI y otros elementos necesarios
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

// Este componente maneja la lógica de autenticación y renderiza la interfaz principal o la pantalla de bienvenida según el estado de autenticación del usuario
export default function HomePage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  // Verificar la sesión del usuario al montar el componente y escuchar cambios en el estado de autenticación
  useEffect(() => {
    // Crear una instancia de Supabase para interactuar con la autenticación
    const supabase = createClient()

    // El Magic Link de "olvidé mi PIN" aterriza aquí (en / con ?code=...),
    // no siempre en /auth/callback. IMPORTANTE: la sola presencia de
    // `?code=` en la URL NO prueba nada — cualquiera puede escribir esa
    // URL a mano. Y el código PKCE de Supabase (a diferencia del flujo
    // implícito con #access_token) tampoco se auto-consume solo por
    // estar en la URL. La única prueba real de que el link del correo se
    // usó es que `exchangeCodeForSession(code)` responda sin error —
    // mismo patrón que ya usa app/auth/reset-password/page.tsx.
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      // Limpiar el `code` de la URL de inmediato — de un solo uso, no debe
      // quedar reutilizable vía historial/back-forward.
      window.history.replaceState({}, '', window.location.pathname)
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          fetch('/api/pin/finalize-reset', { method: 'POST' }).catch(() => {})
        }
      })
    }

    // Verificar la sesión del usuario para determinar si está autenticado o no
    supabase.auth.getUser().then(({ data: { user } }) => {
      // Actualizar el estado de autenticación basado en la presencia de un usuario en la sesión
      setAuthenticated(!!user)
      setLoading(false)
    })
    // Escuchar cambios en el estado de autenticación para actualizar la interfaz en consecuencia
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      // Actualizar el estado de autenticación basado en la sesión actual del usuario
      setAuthenticated(!!session?.user)
    })
    // Limpiar la suscripción al desmontar el componente para evitar fugas de memoria
    return () => subscription.unsubscribe()
  }, [])

  // Renderizar una pantalla de carga mientras se verifica la autenticación, una pantalla de bienvenida si no está autenticado, o la interfaz principal si está autenticado
  if (loading) {
    // Mostrar una pantalla de carga mientras se verifica la autenticación del usuario
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading SOSecure...</p>
        </div>
      </div>
    )
  }

  // Si el usuario no está autenticado, mostrar una pantalla de bienvenida con opciones para iniciar sesión o registrarse
  if (!authenticated) {
    // Renderizar la pantalla de bienvenida con el logo, título, descripción y enlaces para iniciar sesión o registrarse
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">SOSecure</h1>
            <p className="text-muted-foreground">{t('app_tagline')}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="flex items-center justify-center h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
            >
              {t('app_signIn')}
            </Link>
            <Link
              href="/auth/sign-up"
              className="flex items-center justify-center h-11 rounded-lg border border-border text-foreground font-semibold text-sm"
            >
              {t('app_createAccount')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Si el usuario está autenticado, renderizar la interfaz principal de la aplicación
  return <AppShell />
}
