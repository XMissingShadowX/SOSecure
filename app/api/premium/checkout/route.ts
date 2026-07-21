/*
  POST /api/premium/checkout
  Maneja la suscripción recurrente del Plan Premium (mensual, individual).

  Proveedores:
   - Mercado Pago: usa preapproval (suscripción mensual automática)
   - PayPal: usa Subscriptions API (requiere PAYPAL_PREMIUM_PLAN_ID en env)

  Acciones:
   - create-session (default): crea la suscripción y devuelve { url }
   - capture-mercadopago: verifica preapproval al regresar del checkout de MP
   - capture-paypal: verifica suscripción al regresar del checkout de PayPal
   - activate: activa manualmente (modo demo / admin)
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { PREMIUM_PLAN } from '@/lib/plan-config'
import { validateJsonContentType } from '@/lib/api-validation'
import { adminClient, getPayPalToken, PAYPAL_BASE } from '@/lib/checkout-provider'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const MP_PREMIUM_PLAN_ID = process.env.MERCADOPAGO_PREMIUM_PLAN_ID
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_PREMIUM_PLAN_ID = process.env.PAYPAL_PREMIUM_PLAN_ID

async function ensureSubRow(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data: existing } = await admin
    .from('premium_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing

  const { data } = await admin
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
    const admin = adminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const ctErr = validateJsonContentType(req)
    if (ctErr) return ctErr

    const body = (await req.json().catch(() => ({}))) as { action?: string; token?: string; provider?: string }
    const { action, token, provider } = body

    console.log('[premium/checkout] body:', { action, provider })
    const sub = await ensureSubRow(admin, user.id)
    console.log('[premium/checkout] sub:', sub?.id)
    if (!sub) return NextResponse.json({ error: 'No se pudo crear la suscripción' }, { status: 500 })

    // ── Verificar preapproval de Mercado Pago al regresar ──────────────
    if (action === 'capture-mercadopago') {
      if (!token) return NextResponse.json({ error: 'Falta preapproval_id' }, { status: 400 })
      if (!MP_ACCESS_TOKEN) return NextResponse.json({ error: 'MP no configurado' }, { status: 500 })

      const res = await fetch(`https://api.mercadopago.com/preapproval/${token}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const preapproval = await res.json()

      if (preapproval.status === 'authorized') {
        const now = new Date()
        const end = new Date(now)
        end.setMonth(end.getMonth() + 1)
        await admin.from('premium_subscriptions')
          .update({
            status: 'active',
            provider: 'mercadopago',
            provider_ref: preapproval.id,
            amount_cents: PREMIUM_PLAN.amountCents,
            currency: PREMIUM_PLAN.currency,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('user_id', user.id)
        return NextResponse.json({ success: true, period_end: end.toISOString() })
      }
      return NextResponse.json({ error: 'Suscripción no autorizada', status: preapproval.status }, { status: 402 })
    }

    // ── Verificar suscripción PayPal al regresar ────────────────────────
    if (action === 'capture-paypal') {
      if (!token) return NextResponse.json({ error: 'Falta subscription_id' }, { status: 400 })

      const accessToken = await getPayPalToken()
      const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${token}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const subscription = await res.json()

      if (subscription.status === 'ACTIVE' || subscription.status === 'APPROVED') {
        const now = new Date()
        const end = new Date(now)
        end.setMonth(end.getMonth() + 1)
        await admin.from('premium_subscriptions')
          .update({
            status: 'active',
            provider: 'paypal',
            provider_ref: subscription.id,
            amount_cents: PREMIUM_PLAN.amountCents,
            currency: PREMIUM_PLAN.currency,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('user_id', user.id)
        return NextResponse.json({ success: true, period_end: end.toISOString() })
      }
      return NextResponse.json({ error: 'Suscripción no activa', status: subscription.status }, { status: 402 })
    }

    // ── Activar manualmente (demo / admin) ────────────────────────────
    if (action === 'activate') {
      const now = new Date()
      const end = new Date(now)
      end.setMonth(end.getMonth() + 1)
      await admin.from('premium_subscriptions')
        .update({
          status: 'active',
          provider: sub.provider ?? 'demo',
          amount_cents: PREMIUM_PLAN.amountCents,
          currency: PREMIUM_PLAN.currency,
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
        })
        .eq('id', sub.id)
      return NextResponse.json({ success: true, status: 'active', period_end: end.toISOString() })
    }

    // ── Crear suscripción ──────────────────────────────────────────────
    const successUrl = `${BASE_URL}/plan-premium/pago/?status=success`
    const cancelUrl = `${BASE_URL}/plan-premium/pago/?status=cancel`

    // 1) Mercado Pago — usar init_point del plan directamente
    if (MP_ACCESS_TOKEN && MP_PREMIUM_PLAN_ID && provider !== 'paypal') {
      const res = await fetch(`https://api.mercadopago.com/preapproval_plan/${MP_PREMIUM_PLAN_ID}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const plan = await res.json()
      console.log('[premium/checkout] MP plan:', JSON.stringify(plan))
      const url = plan.init_point
      if (!url) return NextResponse.json({ error: 'No se pudo obtener el plan de Mercado Pago', detail: plan }, { status: 502 })

      await admin.from('premium_subscriptions')
        .update({ provider: 'mercadopago' })
        .eq('id', sub.id)
      return NextResponse.json({ url, provider: 'mercadopago' })
    }

    // 2) PayPal Subscriptions (requiere PAYPAL_PREMIUM_PLAN_ID)
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_PREMIUM_PLAN_ID) {
      const accessToken = await getPayPalToken()
      const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `premium-${sub.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          plan_id: PAYPAL_PREMIUM_PLAN_ID,
          subscriber: { email_address: user.email },
          custom_id: sub.id,
          application_context: {
            return_url: successUrl,
            cancel_url: cancelUrl,
            brand_name: 'SOSecure',
            user_action: 'SUBSCRIBE_NOW',
          },
        }),
      })
      const subscription = await res.json()
      const approveLink = subscription.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')?.href
      if (!approveLink) return NextResponse.json({ error: 'PayPal no devolvió URL de aprobación', detail: subscription }, { status: 502 })

      await admin.from('premium_subscriptions')
        .update({ provider: 'paypal', provider_ref: subscription.id })
        .eq('id', sub.id)
      return NextResponse.json({ url: approveLink, provider: 'paypal' })
    }

    // 3) Sin pasarela configurada → demo
    return NextResponse.json({ url: `${BASE_URL}/plan-premium/pago/?demo=1`, provider: 'demo' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
