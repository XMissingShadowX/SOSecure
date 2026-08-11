'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Mail, Lock, Eye, EyeOff, User, Phone, AlertCircle, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clientAppUrl } from '@/lib/app-url'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'
import { useTranslation, LANG_LABELS, type Lang } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'

export default function SignUpPage() {
  const router = useRouter()
  const { language, setLanguage } = useAppStore()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!acceptedTerms || !acceptedPrivacy) {
      setError(t('auth_mustAccept'))
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Explícito en vez de `undefined` — depender del Site URL por defecto de
        // Supabase es frágil (si el dashboard queda mal configurado, ej. apuntando
        // a localhost, el correo de confirmación redirige ahí sin importar el
        // dominio real). Mismo patrón que el flujo de "olvidé mi PIN".
        emailRedirectTo: `${clientAppUrl()}/auth/callback`,
        data: { full_name: fullName, phone },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      router.push('/')
    } else {
      router.push(`/auth/sign-up-success?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-primary" />
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
            <CardTitle className="text-xl">{t('auth_createAccount')}</CardTitle>
            <CardDescription>{t('auth_createDesc')}</CardDescription>
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
                  <FieldLabel>{t('auth_fullName')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><User className="w-4 h-4" /></InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      placeholder={t('auth_namePlaceholder')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel>{t('auth_phone')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Phone className="w-4 h-4" /></InputGroupAddon>
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
                      placeholder={t('auth_passwordPlaceholder')}
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
                  <p className="text-xs text-muted-foreground mt-1">{t('auth_passwordMin')}</p>
                </Field>

                <div className="space-y-3 pt-1">
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-input accent-primary flex-shrink-0"
                    />
                    <span className="text-xs text-muted-foreground leading-snug">
                      {t('auth_termsText').split('{terms}')[0]}
                      <Link href="/terminos" target="_blank" className="text-primary hover:underline font-medium">
                        {t('auth_terms')}
                      </Link>
                      {t('auth_termsText').split('{terms}')[1]}
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-input accent-primary flex-shrink-0"
                    />
                    <span className="text-xs text-muted-foreground leading-snug">
                      {t('auth_privacyText').split('{privacy}')[0]}
                      <Link href="/privacidad" target="_blank" className="text-primary hover:underline font-medium">
                        {t('auth_privacy')}
                      </Link>
                      {t('auth_privacyText').split('{privacy}')[1]}
                    </span>
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !acceptedTerms || !acceptedPrivacy}>
                  {loading ? t('auth_creating') : t('auth_createBtn')}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth_haveAccount')}{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            {t('auth_signIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}
