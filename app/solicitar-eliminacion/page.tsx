'use client'

// Página pública (sin necesidad de tener sesión iniciada ni la app
// instalada) para solicitar la eliminación de la cuenta — requisito de
// tiendas de apps (Play Store/App Store) de ofrecer una vía externa además
// del flujo dentro de la app (Ajustes → Cuenta → Eliminar cuenta en
// components/app-shell.tsx).
//
// Mismo patrón que app/auth/forgot-password/page.tsx: se manda un Magic
// Link con supabase.auth.signInWithOtp() directo desde el navegador (sin
// ruta de servidor intermedia) — Supabase no revela si el correo existe o
// no, así que no hay enumeración de cuentas. El link aterriza en
// /solicitar-eliminacion/confirmar, que recién ahí agenda el borrado.

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import { useTranslation } from '@/lib/i18n'

function RequestAccountDeletionContent() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  // Precargado cuando llega desde Ajustes → Cuenta → Eliminar cuenta
  // (components/app-shell.tsx), que ya conoce el email de la sesión activa.
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/solicitar-eliminacion/confirmar` },
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
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure</h1>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t('account_deletionRequestTitle')}</CardTitle>
            <CardDescription>{t('account_deletionRequestDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-safe" />
                <p className="font-medium">{t('account_deletionRequestSentTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('account_deletionRequestSentDesc').replace('{email}', email)}
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
                    <FieldLabel>{t('auth_email')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon><Mail className="w-4 h-4" /></InputGroupAddon>
                      <InputGroupInput
                        type="email"
                        placeholder={t('home_emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </InputGroup>
                  </Field>
                  <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
                    {loading ? t('account_deletionRequestSending') : t('account_deletionRequestSend')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('settings_deleteAccountNote')}
                  </p>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            {t('auth_backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RequestAccountDeletionPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <RequestAccountDeletionContent />
    </Suspense>
  )
}
