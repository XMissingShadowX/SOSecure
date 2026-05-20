/*
  Este archivo define la página de error de autenticación para la aplicación.
  Muestra un mensaje de error cuando ocurre un problema durante el proceso de autenticación.
  También proporciona un enlace para que el usuario vuelva a la página de inicio de sesión.

  Nota: Asegúrate de configurar correctamente las URL de redirección en tu proyecto de Supabase
  para que apunten a esta página en caso de error durante el inicio de sesión.
*/

// Indicar que este componente se ejecuta en el cliente para poder usar hooks de React
'use client'

// Importar iconos, componentes de UI y la función para crear un cliente de Supabase
import { Shield, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Este componente se encarga de mostrar un mensaje de error de autenticación
export default function AuthErrorPage() {
  // Renderizar la página de error con un mensaje claro y un enlace para volver a la página de inicio de sesión
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure</h1>
        </div>

        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Authentication Error</CardTitle>
            <CardDescription>
              Something went wrong during authentication. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/auth/login">
              <Button className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
