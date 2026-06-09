/*
  Este archivo define la página de registro para la aplicación SOSecure. Permite a los usuarios crear una cuenta proporcionando su nombre completo, correo electrónico y contraseña. Utiliza Supabase para manejar la autenticación y Next.js para la navegación. El diseño se basa en componentes de UI personalizados para una experiencia de usuario consistente y atractiva.

  Requisitos:
  - El formulario debe incluir campos para nombre completo, correo electrónico y contraseña.
  - La contraseña debe tener una opción para mostrar u ocultar el texto ingresado.
  - Al enviar el formulario, se debe crear una cuenta en Supabase y manejar cualquier error que pueda ocurrir durante el proceso de registro.
  - Si el registro es exitoso, el usuario debe ser redirigido a la página principal o a la página de inicio de sesión según la configuración de confirmación de correo electrónico en Supabase.

  Nota: Asegúrate de configurar correctamente las URL de redirección en tu proyecto de Supabase
  para que apunten a esta página después del registro.
*/

'use client'

// Importar hooks de React, componentes de UI y la función para crear un cliente de Supabase
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Eye, EyeOff, User, Phone, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'

// Este componente maneja la lógica de registro y renderiza el formulario de creación de cuenta
export default function SignUpPage() {
  // Estados para manejar el nombre completo, correo electrónico, contraseña, visibilidad de la contraseña, errores y estado de carga
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Función para manejar el envío del formulario de registro
  const handleSignUp = async (e: React.FormEvent) => {
    // Prevenir el comportamiento por defecto del formulario y restablecer errores y estado de carga
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Crear una instancia de Supabase para interactuar con la autenticación
    const supabase = createClient()
    // Intentar registrar al usuario con el nombre completo, correo electrónico y contraseña proporcionados
    const { data, error } = await supabase.auth.signUp({
      // Enviar el nombre completo como parte de los datos adicionales del usuario para que se almacene en el perfil
      email,
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          full_name: fullName,
          phone,
        },
      },
    })

    // Si hay un error durante el registro, mostrar el mensaje de error y detener la carga
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      // Session exists → auto-logged in, go directly to app
      router.push('/')
    } else {
      // Email confirmation required — show "check your inbox" page
      router.push(`/auth/sign-up-success?email=${encodeURIComponent(email)}`)
    }
  }

  // Renderizar el formulario de registro con campos para nombre completo, correo electrónico y contraseña, y mostrar mensajes de error según corresponda
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure</h1>
          <p className="text-sm text-muted-foreground">Tu acompañante de seguridad personal</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription>Comienza a usar SOSecure gratis</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <FieldGroup>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                <Field>
                  <FieldLabel>Nombre completo</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <User className="w-4 h-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      placeholder="Tu nombre"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel>Número de teléfono</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Phone className="w-4 h-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="tel"
                      placeholder="+52 000 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel>Correo electrónico</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Mail className="w-4 h-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="email"
                      placeholder="tu@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel>Contraseña</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Lock className="w-4 h-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Crea una contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <InputGroupAddon 
                      className="cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </InputGroupAddon>
                  </InputGroup>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 6 caracteres
                  </p>
                </Field>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
