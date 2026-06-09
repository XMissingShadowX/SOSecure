'use client'

import Link from 'next/link'
import { Shield, Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function SignUpSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const handleResend = async () => {
    if (!email) return
    setResending(true)
    setResendError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      setResendError(error.message)
    } else {
      setResent(true)
    }
  }

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
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Enviamos un enlace de verificación a{' '}
              {email ? (
                <span className="font-medium text-foreground">{email}</span>
              ) : (
                'tu correo electrónico'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
              <p>1. Abre tu bandeja de entrada</p>
              <p>2. Busca un correo de <span className="font-medium">SOSecure</span></p>
              <p>3. Haz clic en el enlace de verificación</p>
              <p>4. Serás redirigido para iniciar sesión</p>
            </div>

            {resendError && (
              <p className="text-xs text-destructive text-center">{resendError}</p>
            )}

            {resent ? (
              <p className="text-xs text-green-600 text-center font-medium">
                ✓ Correo reenviado correctamente
              </p>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending || !email}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Reenviando...' : 'Reenviar correo'}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <Link href="/auth/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ¿Correo equivocado?{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline">
            Regístrate de nuevo
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignUpSuccessPage() {
  return (
    <Suspense>
      <SignUpSuccessContent />
    </Suspense>
  )
}
