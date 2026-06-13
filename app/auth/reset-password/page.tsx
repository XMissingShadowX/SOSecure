'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase envía ?code=... cuando se usa PKCE (flujo por defecto en v2).
  // Intercambiamos el code por una sesión de tipo "recovery" antes de permitir el cambio.
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('Enlace inválido o expirado. Solicita uno nuevo.')
      return
    }
    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError('El enlace ha expirado o ya fue usado. Solicita uno nuevo.')
      } else {
        setSessionReady(true)
      }
    })
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    }
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
            <CardTitle className="text-xl">Nueva contraseña</CardTitle>
            <CardDescription>Elige una contraseña segura para tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-safe" />
                <p className="font-medium">¡Contraseña actualizada!</p>
                <p className="text-sm text-muted-foreground">Redirigiendo al inicio de sesión...</p>
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
                    <FieldLabel>Nueva contraseña</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={!sessionReady}
                      />
                      <InputGroupAddon className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel>Confirmar contraseña</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Repite la contraseña"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        disabled={!sessionReady}
                      />
                    </InputGroup>
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
                    {!sessionReady && !error ? 'Verificando enlace...' : loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Cargando...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
