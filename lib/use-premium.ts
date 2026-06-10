/*
  Hook usePremium — facilita "gatear" (bloquear/desbloquear) funciones
  premium en cualquier componente.

  Uso:
    const { active, loading } = usePremium()
    if (!active) return <BloqueoPremium />   // o deshabilita el botón

  Por defecto usa has_premium_access (Premium individual O Plan Familiar).
  Si solo quieres considerar el plan Premium individual, pasa { strict: true }.
*/

'use client'

import { useEffect, useState } from 'react'
import { hasActivePremium, hasPremiumAccess } from '@/lib/premium'

export function usePremium(opts: { strict?: boolean } = {}) {
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const check = opts.strict ? hasActivePremium : hasPremiumAccess
    check()
      .then(v => { if (alive) setActive(v) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [opts.strict])

  return { active, loading }
}
