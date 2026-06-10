/*
  POST /api/premium/checkout
  Maneja la activación del Plan Premium (individual, mensual). Dos acciones:

  1) action: 'create-session'  (por defecto)
     Crea una sesión de pago en una pasarela ALOJADA y devuelve { url }
     para redirigir al usuario. Detecta el proveedor según las llaves:
       - Mercado Pago  (MERCADOPAGO_ACCESS_TOKEN)   ← recomendado en México
       - Stripe        (STRIPE_SECRET_KEY)
       - demo          (sin llaves) → devuelve la URL del formulario demo
     La activación REAL ocurre en el webhook del proveedor, no aquí.

  2) action: 'activate'
     Activa el plan directamente. Úsalo para el MODO DEMO de la
     presentación o para activaciones manuales.
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { PREMIUM_PLAN } from '@/lib/plan-config'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

/** Crea la fila de suscripción si no existe y devuelve su id. */
async function ensureSubRow(supabase: any, userId: string) {
  const { data: existing } = await supabase
    .from('premium_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing

  const { data } = await supabase
    .from('premium_subscriptions')
    .insert({
      user_id: userId,
      plan_id: PREMIUM_PLAN.id,
      status: 'pending',
      currency: PREMIUM_PLAN.currency,
      amount_cents: PREMIUM_PLAN.amountCents,
    })
    .select('*')
    .single()

  return data
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { action } = (await req.json().catch(() => ({}))) as { action?: string }

    const sub = await ensureSubRow(supabase, user.id)
    if (!sub) {
      return NextResponse.json({ error: 'No se pudo crear la suscripción' }, { status: 500 })
    }

    // ── Acción: activar (modo demo / manual) ───────────────────────────
    if (action === 'activate') {
      const now = new Date()
      const end = new Date(now)
      end.setMonth(end.getMonth() + 1) // mensual

      const { error } = await supabase
        .from('premium_subscriptions')
        .update({
          status: 'active',
          provider: sub.provider ?? 'demo',
          amount_cents: PREMIUM_PLAN.amountCents,
          currency: PREMIUM_PLAN.currency,
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
        })
        .eq('id', sub.id)
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        status: 'active',
        period_end: end.toISOString(),
      })
    }

    // ── Acción por defecto: crear sesión en pasarela alojada ────────────
    const successUrl = `${BASE_URL}/plan-premium/pago/?status=success`
    const cancelUrl = `${BASE_URL}/plan-premium/pago/?status=cancel`

    // 1) Mercado Pago (recomendado en MX: tarjeta, OXXO, SPEI)
    if (MP_ACCESS_TOKEN) {
      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            title: `${PREMIUM_PLAN.name} — SOSecure`,
            description: `Acceso premium por 1 ${PREMIUM_PLAN.period}`,
            quantity: 1,
            currency_id: PREMIUM_PLAN.currency,
            unit_price: PREMIUM_PLAN.amountCents / 100,
          }],
          back_urls: { success: successUrl, failure: cancelUrl, pending: successUrl },
          auto_return: 'approved',
          external_reference: sub.id,
          metadata: { subscription_id: sub.id, user_id: user.id, kind: 'premium' },
          notification_url: `${BASE_URL}/api/premium/webhook`,
        }),
      })
      const data = await res.json()
      const url = data.init_point ?? data.sandbox_init_point
      if (!url) {
        return NextResponse.json({ error: 'No se pudo crear la preferencia de Mercado Pago', detail: data }, { status: 502 })
      }
      await supabase.from('premium_subscriptions')
        .update({ provider: 'mercadopago', provider_ref: data.id })
        .eq('id', sub.id)
      return NextResponse.json({ url, provider: 'mercadopago' })
    }

    // 2) Stripe Checkout
    if (STRIPE_SECRET_KEY) {
      const params = new URLSearchParams()
      params.append('mode', 'payment')
      params.append('success_url', successUrl)
      params.append('cancel_url', cancelUrl)
      params.append('client_reference_id', sub.id)
      params.append('metadata[subscription_id]', sub.id)
      params.append('metadata[user_id]', user.id)
      params.append('metadata[kind]', 'premium')
      params.append('line_items[0][quantity]', '1')
      params.append('line_items[0][price_data][currency]', PREMIUM_PLAN.currency.toLowerCase())
      params.append('line_items[0][price_data][unit_amount]', String(PREMIUM_PLAN.amountCents))
      params.append('line_items[0][price_data][product_data][name]', `${PREMIUM_PLAN.name} — SOSecure`)

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })
      const data = await res.json()
      if (!data.url) {
        return NextResponse.json({ error: 'No se pudo crear la sesión de Stripe', detail: data }, { status: 502 })
      }
      await supabase.from('premium_subscriptions')
        .update({ provider: 'stripe', provider_ref: data.id })
        .eq('id', sub.id)
      return NextResponse.json({ url: data.url, provider: 'stripe' })
    }

    // 3) Sin pasarela configurada → usar formulario demo de la misma página
    return NextResponse.json({
      url: `${BASE_URL}/plan-premium/pago/?demo=1`,
      provider: 'demo',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
