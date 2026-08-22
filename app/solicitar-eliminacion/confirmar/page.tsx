'use client'

// Confirmación del Magic Link de app/solicitar-eliminacion/page.tsx. Mismo
// cuidado que app/auth/callback/page.tsx y app/page.tsx con el flujo de
// "olvidé mi PIN": la única prueba válida de que el link se usó es que
// exchangeCodeForSession(code) resuelva sin error — nunca la sola
// presencia de ?code= en la URL. Recién ahí se llama POST
// /api/delete-account (la misma ruta que usa el botón de Ajustes → Cuenta),
// que agenda scheduled_deletion_at = now() + 30 días y cierra la sesión.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'

type Status = 'verifying' | 'success' | 'error'

export default function ConfirmAccountDeletionPage() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<Status>('verifying')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const supabase = createClient()

    const run = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        setStatus('error')
        return
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setStatus('error')
        return
      }

      const res = await fetch('/api/delete-account', { method: 'POST' })
      await supabase.auth.signOut()
      setStatus(res.ok ? 'success' : 'error')
    }
    run()
  }, [mounted])

  if (!mounted) return null

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
            <CardTitle className="text-xl">{t('account_deletionConfirmTitle')}</CardTitle>
            {status === 'verifying' && <CardDescription>{t('account_deletionConfirmVerifying')}</CardDescription>}
          </CardHeader>
          <CardContent>
            {status === 'success' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-safe" />
                <p className="text-sm text-muted-foreground">{t('account_deletionConfirmSuccess')}</p>
              </div>
            )}
            {status === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-muted-foreground">{t('account_deletionConfirmError')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline">
            {t('auth_backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
