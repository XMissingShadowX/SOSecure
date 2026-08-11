'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import { useTranslation } from '@/lib/i18n'

function ResetPasswordContent() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  // El código del correo es de UN SOLO USO. Sin este guard el efecto se
  // reejecutaba —`t` de useTranslation es una función nueva en cada render, y
  // estaba en las dependencias—, así que el primer canje consumía el código y
  // el segundo fallaba: el usuario veía "el enlace ha expirado o ya fue usado"
  // aunque la sesión sí se hubiera establecido.
  const exchangeStarted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || exchangeStarted.current) return
    exchangeStarted.current = true

    // Leer de window.location y no de useSearchParams: así no depende de la
    // identidad del objeto de searchParams entre renders.
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setError(t('auth_resetInvalidLink'))
      return
    }

    // Quitar el código de la URL en cuanto se lee, igual que app/page.tsx —
    // de un solo uso, no debe quedar reutilizable vía historial o recarga.
    window.history.replaceState({}, '', window.location.pathname)

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(t('auth_resetExpired'))
      } else {
        setSessionReady(true)
      }
    })
    // `t` se omite a propósito: incluirlo reejecuta el efecto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  if (!mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('auth_resetShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth_resetNoMatch'))
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
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure</h1>
          <p className="text-sm text-muted-foreground">{t('app_tagline')}</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t('auth_resetTitle')}</CardTitle>
            <CardDescription>{t('auth_resetDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-safe" />
                <p className="font-medium">{t('auth_resetDone')}</p>
                <p className="text-sm text-muted-foreground">{t('auth_resetRedirecting')}</p>
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
                    <FieldLabel>{t('auth_resetNewPass')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth_resetMinChars')}
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
                    <FieldLabel>{t('auth_resetConfirm')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth_resetRepeat')}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        disabled={!sessionReady}
                      />
                    </InputGroup>
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
                    {!sessionReady && !error ? t('auth_resetVerifying') : loading ? t('auth_resetSaving') : t('auth_resetSave')}
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
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
