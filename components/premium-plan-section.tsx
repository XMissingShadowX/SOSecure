/*
  Sección "Plan Premium" dentro del diálogo de Ajustes.
  - Muestra el estado de la suscripción (sin activar / activa).
  - Lista las funciones que desbloquea.
  - Botón "Activar Premium" que REDIRIGE a la página web de pago.
  Usa los componentes de UI de la app para verse igual que el resto.
*/

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, BadgeCheck, Clock, Sparkles, EyeOff, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PREMIUM_PLAN, formatAmount } from '@/lib/plan-config'
import { getSubscription, type PremiumSubscription } from '@/lib/premium'
import { getOwnedGroup, getMemberGroup } from '@/lib/family'
import { useTranslation } from '@/lib/i18n'

export function PremiumPlanSection() {
  const { t } = useTranslation()
  const [sub, setSub] = useState<PremiumSubscription | null>(null)
  const [hasFamilyPlan, setHasFamilyPlan] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [s, owned, member] = await Promise.all([getSubscription(), getOwnedGroup(), getMemberGroup()])
    setSub(s)
    setHasFamilyPlan(owned?.status === 'active' || member?.status === 'active')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isActive = sub?.status === 'active'

  const goToPayment = () => {
    // Redirige a la página web de pago (misma app, sesión compartida)
    window.location.href = '/plan-premium/pago/'
  }

  if (loading) {
    return (
      <div>
        <p className="text-sm font-medium mb-3">{t('plan_premiumNameLabel')}</p>
        <div className="p-3 rounded-lg border border-border text-xs text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium">{t('plan_premiumNameLabel')}</p>
      </div>

      <div className="p-3 rounded-lg border border-primary/40 space-y-3">
        {/* Estado */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('plan_premiumNameLabel')}</p>
            <p className="text-xs text-muted-foreground">
              {formatAmount(PREMIUM_PLAN.amountCents)} / {t('plan_premiumPeriod')} · {t('plan_premiumTagline')}
            </p>
          </div>
          {isActive ? (
            <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/15 px-2 py-1 rounded-full">
              <BadgeCheck className="w-3.5 h-3.5" /> {t('family_active')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" /> {t('family_inactive')}
            </span>
          )}
        </div>

        {/* Funciones que desbloquea */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t('plan_premiumFeature1')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <EyeOff className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t('plan_premiumFeature2')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t('plan_premiumFeature3').replace('{n}', String(PREMIUM_PLAN.features.maxContacts))}</span>
          </div>
        </div>

        {isActive && sub?.current_period_end && (
          <p className="text-xs text-muted-foreground">
            {t('family_validUntil').replace('{date}', new Date(sub.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }))}
          </p>
        )}

        {/* Si tiene plan familiar activo: ya tiene acceso premium incluido */}
        {!isActive && hasFamilyPlan && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
            <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-primary font-medium">Incluido en tu Plan Familiar</p>
          </div>
        )}

        {/* Si NO está activo y no tiene plan familiar: mostrar botón de compra */}
        {!isActive && !hasFamilyPlan && (
          <Button className="w-full" size="sm" onClick={goToPayment}>
            <Star className="w-3.5 h-3.5 mr-1" />
            {t('plan_premiumActivateBtn').replace('{amount}', formatAmount(PREMIUM_PLAN.amountCents)).replace('{period}', t('plan_premiumPeriod'))}
          </Button>
        )}

        {isActive && (
          <p className="text-xs text-primary">{t('plan_premiumUnlocked')}</p>
        )}
      </div>
    </div>
  )
}
