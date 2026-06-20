'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import { useTranslation, LANG_LABELS, type Lang } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setLanguage } = useAppStore()
  const { t } = useTranslation()
  const language = useAppStore(s => s.language)
  const [mounted, setMounted] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const justRegistered = searchParams.get('registered') === '1'

  useEffect(() => {
    setMounted(true)
    // Auto-detect browser language on first load (only maps es/en; indigenous require manual selection)
    const stored = useAppStore.getState().language
    if (stored === 'es') {
      const browserCode = navigator.language.split('-')[0]
      if (browserCode === 'en') setLanguage('en')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
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
          <p className="text-sm text-muted-foreground">{t('auth_tagline')}</p>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-1 flex-1">
            {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  language === code
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t('auth_login')}</CardTitle>
            <CardDescription>{t('auth_loginDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {justRegistered && (
              <div className="flex items-center gap-2 p-3 bg-safe/10 text-safe rounded-lg text-sm mb-4">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{t('auth_accountCreated')}</span>
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
                  <FieldLabel>{t('auth_email')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Mail className="w-4 h-4" /></InputGroupAddon>
                    <InputGroupInput
                      type="email"
                      placeholder={t('auth_emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel>{t('auth_password')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Lock className="w-4 h-4" /></InputGroupAddon>
                    <InputGroupInput
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth_passwordCurrent')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <InputGroupAddon className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <div className="flex justify-end">
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    {t('auth_forgotPassword')}
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth_loggingIn') : t('auth_loginBtn')}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth_noAccount')}{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline">
            {t('auth_signUpFree')}
          </Link>
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
