/*
  POST /api/family/checkout
  Maneja la suscripción recurrente del Plan Familiar.

  Proveedores:
   - Mercado Pago: usa preapproval (suscripción anual automática)
   - PayPal: usa Subscriptions API (requiere PAYPAL_FAMILY_PLAN_ID en env)

  Acciones:
   - create-session (default): crea la suscripción y devuelve { url }
   - capture-mercadopago: verifica preapproval al regresar del checkout de MP
   - capture-paypal: verifica suscripción al regresar del checkout de PayPal
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { FAMILY_PLAN } from '@/lib/plan-config'
import { validateJsonContentType } from '@/lib/api-validation'
import { adminClient, getPayPalToken, PAYPAL_BASE } from '@/lib/checkout-provider'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const MP_FAMILY_PLAN_ID = process.env.MERCADOPAGO_FAMILY_PLAN_ID
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_FAMILY_PLAN_ID = process.env.PAYPAL_FAMILY_PLAN_ID

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const ctErr = validateJsonContentType(req)
    if (ctErr) return ctErr

    const body = (await req.json().catch(() => ({}))) as { action?: string; token?: string; provider?: string }
    const { action, token, provider } = body

    const admin = adminClient()

    // Obtener o crear grupo
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

    if (!group) return NextResponse.json({ error: 'No se pudo crear el grupo familiar' }, { status: 500 })

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
        end.setFullYear(end.getFullYear() + 1)
        await admin.from('family_groups')
          .update({
            status: 'active',
            provider: 'mercadopago',
            provider_ref: preapproval.id,
            amount_cents: FAMILY_PLAN.amountCents,
            currency: FAMILY_PLAN.currency,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('id', group.id)
          .eq('owner_id', user.id)
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
        end.setFullYear(end.getFullYear() + 1)
        await admin.from('family_groups')
          .update({
            status: 'active',
            provider: 'paypal',
            provider_ref: subscription.id,
            amount_cents: FAMILY_PLAN.amountCents,
            currency: FAMILY_PLAN.currency,
            current_period_start: now.toISOString(),
            current_period_end: end.toISOString(),
          })
          .eq('id', group.id)
          .eq('owner_id', user.id)
        return NextResponse.json({ success: true, period_end: end.toISOString() })
      }
      return NextResponse.json({ error: 'Suscripción no activa', status: subscription.status }, { status: 402 })
    }

    // ── Crear suscripción ──────────────────────────────────────────────
    const successUrl = `${BASE_URL}/plan-familiar/pago/?status=success`
    const cancelUrl = `${BASE_URL}/plan-familiar/pago/?status=cancel`

    // 1) Mercado Pago — usar init_point del plan directamente
    if (MP_ACCESS_TOKEN && MP_FAMILY_PLAN_ID && provider !== 'paypal') {
      const res = await fetch(`https://api.mercadopago.com/preapproval_plan/${MP_FAMILY_PLAN_ID}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const data = await res.json()
      const initPoint = data.init_point
      if (!initPoint) return NextResponse.json({ error: 'No se pudo crear la suscripción de Mercado Pago', detail: data }, { status: 502 })

      // external_reference vincula la preapproval (y sus pagos de renovación)
      // con este grupo — sin esto, el webhook de renovación ('payment') no
      // puede saber a qué grupo activar.
      const url = `${initPoint}${initPoint.includes('?') ? '&' : '?'}external_reference=${encodeURIComponent(group.id)}`

      await admin.from('family_groups')
        .update({ provider: 'mercadopago', provider_ref: data.id })
        .eq('id', group.id)
      return NextResponse.json({ url, provider: 'mercadopago' })
    }

    // 2) PayPal Subscriptions (requiere PAYPAL_FAMILY_PLAN_ID)
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_FAMILY_PLAN_ID) {
      const accessToken = await getPayPalToken()
      const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `family-${group.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          plan_id: PAYPAL_FAMILY_PLAN_ID,
          subscriber: { email_address: user.email },
          custom_id: group.id,
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

      await admin.from('family_groups')
        .update({ provider: 'paypal', provider_ref: subscription.id })
        .eq('id', group.id)
      return NextResponse.json({ url: approveLink, provider: 'paypal' })
    }

    // 3) Sin pasarela configurada → demo
    return NextResponse.json({ url: `${BASE_URL}/plan-familiar/pago/?demo=1`, provider: 'demo' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
