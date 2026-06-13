/*
  Este archivo define la página de inicio de sesión para la aplicación SOSecure.
  Permite a los usuarios ingresar su correo electrónico y contraseña para acceder a sus cuentas.
  También maneja la lógica de autenticación utilizando Supabase y muestra mensajes de error o éxito según corresponda.

  Nota: Asegúrate de configurar correctamente las URL de redirección en tu proyecto de Supabase
  para que apunten a esta página después del inicio de sesión.
*/

'use client'

// Importar hooks de React, componentes de UI y la función para crear un cliente de Supabase
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import { Suspense } from 'react'

// Este componente maneja la lógica de inicio de sesión y renderiza el formulario de autenticación
function LoginContent() {
  // Estados para manejar el correo electrónico, contraseña, visibilidad de la contraseña, errores y estado de carga
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const justRegistered = searchParams.get('registered') === '1'

  // Función para manejar el envío del formulario de inicio de sesión
  const handleSignIn = async (e: React.FormEvent) => {
    // Prevenir el comportamiento por defecto del formulario y restablecer errores y estado de carga
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Crear una instancia de Supabase para interactuar con la autenticación
    const supabase = createClient()
    // Intentar iniciar sesión con el correo electrónico y contraseña proporcionados
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    // Si hay un error durante el inicio de sesión, mostrar el mensaje de error y detener la carga
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  // Renderizar el formulario de inicio de sesión con campos para correo electrónico y contraseña, y mostrar mensajes de error o éxito según corresponda
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure</h1>
          <p className="text-sm text-muted-foreground">Tu acompañante de seguridad personal</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>Ingresa a tu cuenta de SOSecure</CardDescription>
          </CardHeader>
          <CardContent>
            {justRegistered && (
              <div className="flex items-center gap-2 p-3 bg-safe/10 text-safe rounded-lg text-sm mb-4">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>¡Cuenta creada! Inicia sesión para continuar.</span>
              </div>
            )}
            <form onSubmit={handleSignIn}>
              <FieldGroup>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Field>
                  <FieldLabel>Correo electrónico</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Mail className="w-4 h-4" /></InputGroupAddon>
                    <InputGroupInput type="email" placeholder="tu@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel>Contraseña</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                    <InputGroupInput type={showPassword ? 'text' : 'password'} placeholder="Tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <InputGroupAddon className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <div className="flex justify-end">
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LoginContent />
    </Suspense>
  )
}