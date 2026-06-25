/*
  POST /api/premium/webhook
  Recibe la confirmación de pago del proveedor y ACTIVA el plan premium.
  Usa SUPABASE_SERVICE_ROLE_KEY porque corre sin sesión de usuario.

  Soporta:
   - Stripe:        evento checkout.session.completed
   - Mercado Pago:  notificación de payment (topic=payment)
   - PayPal:        evento PAYMENT.CAPTURE.COMPLETED

  Configura la URL de este webhook en el panel del proveedor:
   - Stripe:        https://sosecure.site/api/premium/webhook
   - Mercado Pago:  misma URL (se manda como notification_url al crear la preferencia)
   - PayPal:        https://sosecure.site/api/premium/webhook  (en Developer Dashboard → Webhooks)

  Nota sobre seguridad: en producción verifica la firma del webhook
  (Stripe-Signature / x-signature de Mercado Pago / PayPal-Transmission-Sig).
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PREMIUM_PLAN } from '@/lib/plan-config'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID_PREMIUM
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function verifyMercadoPagoSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return true
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
  if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return true
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
  } catch {
    return false
  }
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function activateSub(subId: string, provider: string, ref?: string) {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1) // mensual

  await admin()
    .from('premium_subscriptions')
    .update({
      status: 'active',
      provider,
      provider_ref: ref ?? null,
      amount_cents: PREMIUM_PLAN.amountCents,
      currency: PREMIUM_PLAN.currency,
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
    })
    .eq('id', subId)
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody || '{}')

    // ── Stripe ─────────────────────────────────────────────
    if (body?.type === 'checkout.session.completed') {
      const session = body.data?.object
      // Solo activar si es un pago de tipo premium
      if (session?.metadata?.kind === 'premium' || session?.metadata?.subscription_id) {
        const subId = session?.metadata?.subscription_id || session?.client_reference_id
        if (subId) {
          await activateSub(subId, 'stripe', session?.id)
        }
      }
      return NextResponse.json({ received: true })
    }

    // ── Mercado Pago ───────────────────────────────────────
    if (body?.type === 'payment' && body?.data?.id && MP_ACCESS_TOKEN) {
      const valid = await verifyMercadoPagoSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      const paymentId = body.data.id
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const payment = await res.json()
      if (payment?.status === 'approved' && payment?.metadata?.kind === 'premium') {
        const subId = payment.external_reference || payment.metadata?.subscription_id
        if (subId) {
          await activateSub(subId, 'mercadopago', String(paymentId))
        }
      }
      return NextResponse.json({ received: true })
    }

    // ── PayPal ─────────────────────────────────────────────
    if (body?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const valid = await verifyPayPalSignature(req, rawBody)
      if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      const resource = body?.resource
      // custom_id lo pusimos en la orden al crearla
      const subId = resource?.custom_id
        ?? resource?.purchase_units?.[0]?.custom_id
      if (subId) {
        await activateSub(subId, 'paypal', resource?.id)
      }
      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true, ignored: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Mercado Pago y PayPal a veces hacen GET de validación
export async function GET() {
  return NextResponse.json({ ok: true })
}
