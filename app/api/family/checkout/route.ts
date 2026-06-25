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
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { FAMILY_PLAN } from '@/lib/plan-config'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getPayPalToken(): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string; token?: string; provider?: string }
    const { action, token, provider: preferredProvider } = body

    // Grupo del dueño — usar admin para evitar bloqueo RLS en SELECT e INSERT
    const admin = adminClient()
    let { data: group } = await admin
      .from('family_groups')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!group) {
      const { data: newGroup } = await admin
        .from('family_groups')
        .insert({
          owner_id: user.id,
          name: 'Mi Plan Familiar',
          plan_id: FAMILY_PLAN.id,
          max_members: FAMILY_PLAN.maxMembers,
          status: 'pending',
          currency: FAMILY_PLAN.currency,
          amount_cents: FAMILY_PLAN.amountCents,
        })
        .select('*')
        .single()

      if (newGroup) {
        await admin.from('family_members').insert({
          group_id: newGroup.id,
          user_id: user.id,
          email: user.email ?? '',
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        })
      }
      group = newGroup
    }

    if (!group) {
      return NextResponse.json({ error: 'No se pudo crear el grupo familiar' }, { status: 500 })
    }

    // ── Acción: capturar orden PayPal ──────────────────────────────────
    if (action === 'capture-paypal') {
      if (!token) return NextResponse.json({ error: 'Falta token de PayPal' }, { status: 400 })

      const accessToken = await getPayPalToken()
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      const capture = await res.json()
      if (capture.status === 'COMPLETED') {
        const now = new Date()
        const end = new Date(now)
        end.setFullYear(end.getFullYear() + 1)
        await admin.from('family_groups')
          .update({
            status: 'active',
            provider: 'paypal',
            provider_ref: capture.id,
            amount_cents: FAMILY_PLAN.amountCents,
            currency: FAMILY_PLAN.currency,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('id', group.id)
          .eq('owner_id', user.id)
        return NextResponse.json({ success: true, period_end: end.toISOString() })
      }
      return NextResponse.json({ error: 'La captura no se completó', detail: capture }, { status: 502 })
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

    // Si el usuario eligió PayPal explícitamente, saltar Mercado Pago
    // 1) Mercado Pago (recomendado en MX: tarjeta, OXXO, SPEI)
    if (MP_ACCESS_TOKEN && preferredProvider !== 'paypal') {
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
      await admin.from('family_groups')
        .update({ provider: 'mercadopago', provider_ref: data.id })
        .eq('id', group.id)
      return NextResponse.json({ url, provider: 'mercadopago' })
    }

    // 2) PayPal Orders
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && preferredProvider !== 'mercadopago') {
      const token = await getPayPalToken()
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `${group.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: group.id,
            custom_id: group.id,
            description: `${FAMILY_PLAN.name} — SOSecure`,
            amount: {
              currency_code: FAMILY_PLAN.currency,
              value: (FAMILY_PLAN.amountCents / 100).toFixed(2),
            },
          }],
          application_context: {
            return_url: successUrl,
            cancel_url: cancelUrl,
            brand_name: 'SOSecure',
            user_action: 'PAY_NOW',
          },
        }),
      })
      const order = await res.json()
      const approveLink = order.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')?.href
      if (!approveLink) {
        return NextResponse.json({ error: 'PayPal no devolvió URL de aprobación', detail: order }, { status: 502 })
      }
      await admin.from('family_groups')
        .update({ provider: 'paypal', provider_ref: order.id })
        .eq('id', group.id)
      return NextResponse.json({ url: approveLink, provider: 'paypal' })
    }

    // 3) Stripe Checkout
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
      await admin.from('family_groups')
        .update({ provider: 'stripe', provider_ref: data.id })
        .eq('id', group.id)
      return NextResponse.json({ url: data.url, provider: 'stripe' })
    }

    // 4) Sin pasarela configurada → usar formulario demo de la misma página
    return NextResponse.json({
      url: `${BASE_URL}/plan-familiar/pago/?demo=1`,
      provider: 'demo',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
