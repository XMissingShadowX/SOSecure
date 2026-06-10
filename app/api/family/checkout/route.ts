/*
  POST /api/family/checkout
  Maneja la activación del Plan Familiar. Dos acciones:

  1) action: 'create-session'
     Crea una sesión de pago en una pasarela ALOJADA y devuelve { url }
     para redirigir al usuario. Detecta el proveedor según las llaves
     disponibles:
       - Mercado Pago  (MERCADOPAGO_ACCESS_TOKEN)   ← recomendado en México
       - Stripe        (STRIPE_SECRET_KEY)
       - demo          (sin llaves) → devuelve la URL del formulario demo
     La activación REAL del plan ocurre en el webhook del proveedor
     (ver docs/PLAN_FAMILIAR.md), no aquí.

  2) action: 'activate'
     Activa el plan directamente. Úsalo para el MODO DEMO de la
     presentación o para activaciones manuales. Solo el dueño del grupo.
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { FAMILY_PLAN } from '@/lib/plan-config'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { action } = (await req.json().catch(() => ({}))) as { action?: string }

    // Grupo del dueño
    const { data: group } = await supabase
      .from('family_groups')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Primero crea tu plan familiar' }, { status: 400 })
    }

    // ── Acción: activar (modo demo / manual) ───────────────────────────
    if (action === 'activate') {
      const now = new Date()
      const end = new Date(now)
      end.setFullYear(end.getFullYear() + 1)

      const { error } = await supabase
        .from('family_groups')
        .update({
          status: 'active',
          provider: group.provider ?? 'demo',
          amount_cents: FAMILY_PLAN.amountCents,
          currency: FAMILY_PLAN.currency,
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
        })
        .eq('id', group.id)
        .eq('owner_id', user.id)

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
    const successUrl = `${BASE_URL}/plan-familiar/pago/?status=success`
    const cancelUrl = `${BASE_URL}/plan-familiar/pago/?status=cancel`

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
            title: `${FAMILY_PLAN.name} — SOSecure`,
            description: `Hasta ${FAMILY_PLAN.maxMembers} usuarios por 1 ${FAMILY_PLAN.period}`,
            quantity: 1,
            currency_id: FAMILY_PLAN.currency,
            unit_price: FAMILY_PLAN.amountCents / 100,
          }],
          back_urls: { success: successUrl, failure: cancelUrl, pending: successUrl },
          auto_return: 'approved',
          external_reference: group.id,
          metadata: { group_id: group.id, owner_id: user.id },
          notification_url: `${BASE_URL}/api/family/webhook`,
        }),
      })
      const data = await res.json()
      const url = data.init_point ?? data.sandbox_init_point
      if (!url) {
        return NextResponse.json({ error: 'No se pudo crear la preferencia de Mercado Pago', detail: data }, { status: 502 })
      }
      await supabase.from('family_groups')
        .update({ provider: 'mercadopago', provider_ref: data.id })
        .eq('id', group.id)
      return NextResponse.json({ url, provider: 'mercadopago' })
    }

    // 2) Stripe Checkout
    if (STRIPE_SECRET_KEY) {
      const params = new URLSearchParams()
      params.append('mode', 'payment')
      params.append('success_url', successUrl)
      params.append('cancel_url', cancelUrl)
      params.append('client_reference_id', group.id)
      params.append('metadata[group_id]', group.id)
      params.append('metadata[owner_id]', user.id)
      params.append('line_items[0][quantity]', '1')
      params.append('line_items[0][price_data][currency]', FAMILY_PLAN.currency.toLowerCase())
      params.append('line_items[0][price_data][unit_amount]', String(FAMILY_PLAN.amountCents))
      params.append('line_items[0][price_data][product_data][name]', `${FAMILY_PLAN.name} — SOSecure`)

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
      await supabase.from('family_groups')
        .update({ provider: 'stripe', provider_ref: data.id })
        .eq('id', group.id)
      return NextResponse.json({ url: data.url, provider: 'stripe' })
    }

    // 3) Sin pasarela configurada → usar formulario demo de la misma página
    return NextResponse.json({
      url: `${BASE_URL}/plan-familiar/pago/?demo=1`,
      provider: 'demo',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
