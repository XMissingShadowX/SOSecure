'use client'

import Link from 'next/link'
import { Shield, Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'

function SignUpSuccessContent() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

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
            <CardTitle className="text-xl">{t('auth_checkEmail')}</CardTitle>
            <CardDescription>
              {t('auth_verificationSent')}{' '}
              {email ? (
                <span className="font-medium text-foreground">{email}</span>
              ) : (
                t('auth_yourEmail')
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
              <p>{t('auth_step1')}</p>
              <p>{t('auth_step2')}</p>
              <p>{t('auth_step3')}</p>
              <p>{t('auth_step4')}</p>
            </div>

            {resendError && (
              <p className="text-xs text-destructive text-center">{resendError}</p>
            )}

            {resent ? (
              <p className="text-xs text-green-600 text-center font-medium">
                {t('auth_resent')}
              </p>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending || !email}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
                {resending ? t('auth_resending') : t('auth_resend')}
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
                {t('auth_backToLogin')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t('auth_wrongEmail')}{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline">
            {t('auth_signUpAgain')}
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
