/*
  POST /api/family/webhook
  Webhook unificado para plan familiar Y plan premium de Mercado Pago.
  PayPal usa webhooks separados por plan (family / premium).

  Eventos manejados:
   - MP:     subscription_preapproval (authorized → activa, cancelled → cancela)
   - MP:     payment (pago de renovación aprobado)
   - PayPal: BILLING.SUBSCRIPTION.ACTIVATED / CANCELLED / SUSPENDED
   - PayPal: PAYMENT.SALE.COMPLETED (renovación)
   - Stripe: checkout.session.completed (legado)
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FAMILY_PLAN, PREMIUM_PLAN } from '@/lib/plan-config'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID_FAMILY
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyMercadoPagoSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) {
    console.error('Webhook Mercado Pago rechazado: falta MERCADOPAGO_WEBHOOK_SECRET')
    return false
  }
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const dataId = new URL(req.url).searchParams.get('data.id') ?? ''
  if (!xSignature) return false

  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === v1
}

async function verifyPayPalSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error('Webhook PayPal rechazado: faltan variables de entorno de verificación')
    return false
  }
  try {
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const { access_token } = await tokenRes.json()
    const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.headers.get('paypal-auth-algo'),
        cert_url: req.headers.get('paypal-cert-url'),
        transmission_id: req.headers.get('paypal-transmission-id'),
        transmission_sig: req.headers.get('paypal-transmission-sig'),
        transmission_time: req.headers.get('paypal-transmission-time'),
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    })
    const result = await verifyRes.json()
    return result.verification_status === 'SUCCESS'
  } catch { return false }
}

// matchColumn='id' cuando el valor viene de custom_id (nuestro UUID interno,
// el que nosotros mandamos al crear la suscripción). matchColumn='provider_ref'
// cuando el valor viene de billing_agreement_id (el ID de suscripción que
// PayPal asigna — el que guardamos como provider_ref al activar por primera vez).
async function activateGroup(matchColumn: 'id' | 'provider_ref', matchValue: string, provider: string, ref: string) {
  const now = new Date()
  const end = new Date(now)
  end.setFullYear(end.getFullYear() + 1)
  await admin().from('family_groups').update({
    status: 'active', provider, provider_ref: ref,
    amount_cents: FAMILY_PLAN.amountCents, currency: FAMILY_PLAN.currency,
    current_period_start: now.toISOString(), current_period_end: end.toISOString(),
  }).eq(matchColumn, matchValue)
}

async function cancelGroup(groupId: string) {
  await admin().from('family_groups')
    .update({ status: 'cancelled' })
    .eq('id', groupId)
}

async function activateSub(subId: string, provider: string, ref: string) {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)
  await admin().from('premium_subscriptions').update({
    status: 'active', provider, provider_ref: ref,
    amount_cents: PREMIUM_PLAN.amountCents, currency: PREMIUM_PLAN.currency,
    current_period_start: now.toISOString(), current_period_end: end.toISOString(),
  }).eq('id', subId)
}

async function cancelSub(subId: string) {
  await admin().from('premium_subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subId)
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody || '{}')

    // ── Stripe (legado) ────────────────────────────────────────────────
    if (body?.type === 'checkout.session.completed') {
      const session = body.data?.object
      const groupId = session?.metadata?.group_id || session?.client_reference_id
      if (groupId) await activateGroup('id', groupId, 'stripe', session?.id)
      return NextResponse.json({ received: true })
    }

    // ── Mercado Pago — suscripción (preapproval) ──────────────────────
    if (body?.type === 'subscription_preapproval' && body?.data?.id && MP_ACCESS_TOKEN) {
      const valid = await verifyMercadoPagoSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const preapprovalId = body.data.id
      const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const preapproval = await res.json()
      const payerEmail = preapproval.payer_email
      const MP_PREMIUM_PLAN_ID = process.env.MERCADOPAGO_PREMIUM_PLAN_ID
      const MP_FAMILY_PLAN_ID = process.env.MERCADOPAGO_FAMILY_PLAN_ID
      const isPremium = preapproval.preapproval_plan_id === MP_PREMIUM_PLAN_ID
                     || preapproval.metadata?.kind === 'premium'
                     || !!preapproval.external_reference?.includes?.('premium')

      const db = admin()

      if (preapproval.status === 'authorized') {
        if (isPremium) {
          // Buscar sub por external_reference o por email del pagador
          let subId = preapproval.external_reference || preapproval.metadata?.subscription_id
          if (!subId && payerEmail) {
            const { data: profile } = await db.from('profiles').select('id').eq('email', payerEmail).maybeSingle()
            if (profile) {
              const { data: sub } = await db.from('premium_subscriptions').select('id').eq('user_id', profile.id).maybeSingle()
              subId = sub?.id
            }
          }
          if (subId) await activateSub(subId, 'mercadopago', preapprovalId)
        } else {
          // Buscar grupo por external_reference o por email del pagador
          let groupId = preapproval.external_reference
          if (!groupId && payerEmail) {
            const { data: profile } = await db.from('profiles').select('id').eq('email', payerEmail).maybeSingle()
            if (profile) {
              const { data: group } = await db.from('family_groups').select('id').eq('owner_id', profile.id).maybeSingle()
              groupId = group?.id
            }
          }
          if (groupId) await activateGroup('id', groupId, 'mercadopago', preapprovalId)
        }
      } else if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
        if (isPremium) {
          const subId = preapproval.external_reference || preapproval.metadata?.subscription_id
          if (subId) await cancelSub(subId)
        } else {
          const groupId = preapproval.external_reference
          if (groupId) await cancelGroup(groupId)
        }
      }
      return NextResponse.json({ received: true })
    }

    // ── Mercado Pago — pago de renovación ─────────────────────────────
    if (body?.type === 'payment' && body?.data?.id && MP_ACCESS_TOKEN) {
      const valid = await verifyMercadoPagoSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const paymentId = body.data.id
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const payment = await res.json()
      if (payment?.status === 'approved') {
        // El external_reference apunta al id de premium_subscriptions o de
        // family_groups (seteado al crear la preapproval) — no confiar en
        // metadata.kind, que MP no propaga en pagos de suscripción.
        const extRef = payment.external_reference
        if (extRef) {
          const db = admin()
          const { data: subRow } = await db.from('premium_subscriptions').select('id').eq('id', extRef).maybeSingle()
          if (subRow) {
            await activateSub(extRef, 'mercadopago', String(paymentId))
          } else {
            const { data: groupRow } = await db.from('family_groups').select('id').eq('id', extRef).maybeSingle()
            if (groupRow) await activateGroup('id', extRef, 'mercadopago', String(paymentId))
          }
        }
      }
      return NextResponse.json({ received: true })
    }

    // ── PayPal — suscripción activada ─────────────────────────────────
    if (body?.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const resource = body?.resource
      const groupId = resource?.custom_id ?? resource?.subscriber?.custom_id
      if (groupId) await activateGroup('id', groupId, 'paypal', resource?.id)
      return NextResponse.json({ received: true })
    }

    // ── PayPal — suscripción cancelada / suspendida ───────────────────
    if (body?.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
        body?.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const groupId = body?.resource?.custom_id
      if (groupId) await cancelGroup(groupId)
      return NextResponse.json({ received: true })
    }

    // ── PayPal — pago de renovación (legado one-time) ─────────────────
    if (body?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const resource = body?.resource
      const groupId = resource?.custom_id ?? resource?.purchase_units?.[0]?.custom_id
      if (groupId) await activateGroup('id', groupId, 'paypal', resource?.id)
      return NextResponse.json({ received: true })
    }

    // ── PayPal — pago de renovación (suscripción anual) ────────────────
    // billing_agreement_id es el ID de suscripción de PayPal (I-XXXXXXXX),
    // no nuestro UUID — hay que buscarlo por provider_ref, no por id.
    if (body?.event_type === 'PAYMENT.SALE.COMPLETED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const billingAgreementId = body?.resource?.billing_agreement_id
      const customId = body?.resource?.custom
      if (billingAgreementId) {
        await activateGroup('provider_ref', billingAgreementId, 'paypal', body.resource.id)
      } else if (customId) {
        await activateGroup('id', customId, 'paypal', body.resource.id)
      }
      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true, ignored: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
