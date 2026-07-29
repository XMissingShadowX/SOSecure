/*
  POST /api/premium/webhook
  Webhook para plan premium — solo eventos PayPal.
  Los eventos de Mercado Pago para premium van a /api/family/webhook.
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PREMIUM_PLAN } from '@/lib/plan-config'

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID_PREMIUM
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
async function activateSub(matchColumn: 'id' | 'provider_ref', matchValue: string, provider: string, ref: string) {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)
  await admin().from('premium_subscriptions').update({
    status: 'active', provider, provider_ref: ref,
    amount_cents: PREMIUM_PLAN.amountCents, currency: PREMIUM_PLAN.currency,
    current_period_start: now.toISOString(), current_period_end: end.toISOString(),
  }).eq(matchColumn, matchValue)
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

    // ── PayPal — suscripción activada ─────────────────────────────────
    if (body?.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const subId = body?.resource?.custom_id
      if (subId) await activateSub('id', subId, 'paypal', body.resource.id)
      return NextResponse.json({ received: true })
    }

    // ── PayPal — suscripción cancelada / suspendida ───────────────────
    if (body?.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
        body?.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      const subId = body?.resource?.custom_id
      if (subId) await cancelSub(subId)
      return NextResponse.json({ received: true })
    }

    // ── PayPal — pago de renovación ───────────────────────────────────
    if (body?.event_type === 'PAYMENT.SALE.COMPLETED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

      // billing_agreement_id es el ID de suscripción de PayPal (I-XXXXXXXX),
      // no nuestro UUID — hay que buscarlo por provider_ref, no por id.
      // (custom solo viene poblado en pagos únicos, no en cobros recurrentes.)
      const billingAgreementId = body?.resource?.billing_agreement_id
      const customId = body?.resource?.custom
      if (billingAgreementId) {
        await activateSub('provider_ref', billingAgreementId, 'paypal', body.resource.id)
      } else if (customId) {
        await activateSub('id', customId, 'paypal', body.resource.id)
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
