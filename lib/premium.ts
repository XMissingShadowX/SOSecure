/*
  Helpers de cliente para el Plan Premium (individual, mensual).
  Encapsulan las consultas a Supabase para que la UI no repita lógica.
  Usan el cliente del navegador con RLS.
*/

import { createClient } from '@/lib/supabase/client'
import { PREMIUM_PLAN } from '@/lib/plan-config'

export type PremiumStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired'

export interface PremiumSubscription {
  id: string
  user_id: string
  plan_id: string
  status: PremiumStatus
  provider: string | null
  provider_ref: string | null
  amount_cents: number | null
  currency: string
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

/** Devuelve la suscripción premium del usuario actual (o null). */
export async function getSubscription(): Promise<PremiumSubscription | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('premium_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (data as PremiumSubscription) ?? null
}

/** Crea la fila de suscripción (status pending) si aún no existe. */
export async function ensureSubscription(): Promise<PremiumSubscription | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const existing = await getSubscription()
  if (existing) return existing

  const { data, error } = await supabase
    .from('premium_subscriptions')
    .insert({
      user_id: user.id,
      plan_id: PREMIUM_PLAN.id,
      status: 'pending',
      currency: PREMIUM_PLAN.currency,
      amount_cents: PREMIUM_PLAN.amountCents,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as PremiumSubscription
}

/** ¿El usuario actual tiene plan premium activo? */
export async function hasActivePremium(): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.rpc('has_active_premium')
  return data === true
}

/**
 * ¿El usuario tiene acceso a funciones premium (por Premium individual
 * O por Plan Familiar)? Requiere el RPC has_premium_access del SQL.
 * Si no lo creaste, usa hasActivePremium() en su lugar.
 */
export async function hasPremiumAccess(): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('has_premium_access')
  if (error) {
    // Fallback si el RPC combinado no existe
    return hasActivePremium()
  }
  return data === true
}
