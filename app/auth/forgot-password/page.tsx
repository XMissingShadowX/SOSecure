'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

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
            <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
            <CardDescription>
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-safe" />
                <p className="font-medium">¡Correo enviado!</p>
                <p className="text-sm text-muted-foreground">
                  Revisa tu bandeja de entrada (y spam) en <span className="font-medium text-foreground">{email}</span> y haz clic en el enlace para restablecer tu contraseña.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
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
                      <InputGroupInput
                        type="email"
                        placeholder="tu@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </InputGroup>
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
