'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Delete, AlertCircle, Mail } from 'lucide-react'
import { verifyPin } from '@/lib/pin'
import { createClient } from '@/lib/supabase/client'

interface PinLockProps {
  userId: string
  pinHash: string
  onUnlock: () => void
  onForgotPin: () => void
}

const MAX_ATTEMPTS = 5

export function PinLock({ userId, pinHash, onUnlock, onForgotPin }: PinLockProps) {
  const [digits, setDigits] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleDigit = useCallback(async (d: string) => {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)

    if (next.length === 4) {
      const pin = next.join('')
      const ok = await verifyPin(pin, userId, pinHash)
      if (ok) {
        onUnlock()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setError(true)
        setShake(true)
        setTimeout(() => {
          setDigits([])
          setError(false)
          setShake(false)
        }, 700)

        if (newAttempts >= MAX_ATTEMPTS) {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/auth/login'
        }
      }
    }
  }, [digits, userId, pinHash, attempts, onUnlock])

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

  return (
    <div className="fixed inset-0 z-[99999] bg-background flex flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center gap-8 w-full max-w-xs">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-xl font-bold">SOSecure</h1>
          <p className="text-sm text-muted-foreground">Ingresa tu PIN de seguridad</p>
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
        {error && attempts < MAX_ATTEMPTS && (
          <div className="flex items-center gap-2 text-destructive text-sm -mt-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>PIN incorrecto — {remaining} {remaining === 1 ? 'intento' : 'intentos'} restante{remaining !== 1 ? 's' : ''}</span>
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
                className="h-14 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <Delete className="w-5 h-5" />
              </button>
            )
            return (
              <button
                key={idx}
                onClick={() => handleDigit(k)}
                className="h-14 rounded-2xl text-xl font-semibold bg-muted hover:bg-muted/70 active:scale-95 transition-all"
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
          ¿Olvidaste tu PIN?
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
