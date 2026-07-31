'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Delete, AlertCircle, Mail } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface PinLockProps {
  userId: string
  onUnlock: () => void
  onForgotPin: () => void
}

const MAX_ATTEMPTS = 5
const LOCK_STORAGE_KEY = 'sosecure-pin-locked-until'

export function PinLock({ userId, onUnlock, onForgotPin }: PinLockProps) {
  const [digits, setDigits] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  // El bloqueo real vive en el servidor (Map en memoria), pero el estado de
  // React se resetea al recargar la página. Persistimos el timestamp en
  // sessionStorage para que la UI siga mostrando el bloqueo tras un reload,
  // en vez de dejar escribir dígitos que el servidor de todas formas va a
  // rechazar con 429.
  useEffect(() => {
    const stored = sessionStorage.getItem(LOCK_STORAGE_KEY)
    if (!stored) return
    const lockedUntil = parseInt(stored)
    const remaining = lockedUntil - Date.now()
    if (remaining <= 0) {
      sessionStorage.removeItem(LOCK_STORAGE_KEY)
      return
    }
    setRateLimited(true)
    const timer = setTimeout(() => {
      setRateLimited(false)
      sessionStorage.removeItem(LOCK_STORAGE_KEY)
    }, remaining)
    return () => clearTimeout(timer)
  }, [])

  const handleDigit = useCallback(async (d: string) => {
    if (digits.length >= 4 || rateLimited) return
    const next = [...digits, d]
    setDigits(next)

    if (next.length === 4) {
      const pin = next.join('')
      const res = await fetch('/api/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '300')
        sessionStorage.setItem(LOCK_STORAGE_KEY, String(Date.now() + retryAfter * 1000))
        setRateLimited(true)
        setDigits([])
        setTimeout(() => {
          setRateLimited(false)
          sessionStorage.removeItem(LOCK_STORAGE_KEY)
        }, retryAfter * 1000)
        return
      }

      const { ok } = await res.json().catch(() => ({ ok: false }))
      if (ok) {
        onUnlock()
      } else {
        // El bloqueo tras intentos fallidos lo maneja el servidor (429,
        // más arriba) con un lockout temporal de 5 minutos — ya no se
        // cierra sesión aquí en el cliente.
        setAttempts(a => a + 1)
        setError(true)
        setShake(true)
        setTimeout(() => {
          setDigits([])
          setError(false)
          setShake(false)
        }, 700)
      }
    }
  }, [digits, rateLimited, onUnlock])

  const handleDelete = useCallback(() => {
    setDigits(prev => prev.slice(0, -1))
    setError(false)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      if (e.key === 'Backspace') handleDelete()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleDigit, handleDelete])

  const remaining = MAX_ATTEMPTS - attempts
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-[var(--z-pin-lock)] bg-background ambient-bg flex flex-col items-center justify-center p-6 select-none">
      <div className="glass-strong flex flex-col items-center gap-8 w-full max-w-xs rounded-[2rem] p-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{t('pin_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('pin_enter')}</p>
        </div>

        {/* Dots */}
        <div className={`flex gap-4 transition-transform ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < digits.length
                  ? error ? 'bg-destructive border-destructive' : 'bg-primary border-primary'
                  : 'border-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && !rateLimited && attempts < MAX_ATTEMPTS && (
          <div className="flex items-center gap-2 text-destructive text-sm -mt-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{t('pin_incorrect').replace('{n}', String(remaining)).replace('{s}', remaining !== 1 ? 's' : '')}</span>
          </div>
        )}

        {/* Rate limited message */}
        {rateLimited && (
          <div className="flex items-center gap-2 text-destructive text-sm -mt-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{t('pin_rate_limited')}</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {keys.map((k, idx) => {
            if (k === '') return <div key={idx} />
            if (k === 'del') return (
              <button
                key={idx}
                onClick={handleDelete}
                className="h-14 rounded-2xl glass glass-interactive flex items-center justify-center text-muted-foreground hover:shadow-md transition-all"
              >
                <Delete className="w-5 h-5" />
              </button>
            )
            return (
              <button
                key={idx}
                onClick={() => handleDigit(k)}
                disabled={rateLimited}
                className="h-14 rounded-2xl text-xl font-semibold glass glass-interactive hover:shadow-md transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {k}
              </button>
            )
          })}
        </div>

        {/* Forgot PIN */}
        <button
          onClick={onForgotPin}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
        >
          <Mail className="w-4 h-4" />
          {t('pin_forgot')}
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
