/*
  POST /api/premium/webhook
  Recibe la confirmación de pago del proveedor y ACTIVA el plan premium.
  Usa SUPABASE_SERVICE_ROLE_KEY porque corre sin sesión de usuario.

  Soporta:
   - Stripe:        evento checkout.session.completed
   - Mercado Pago:  notificación de payment (topic=payment)

  Configura la URL de este webhook en el panel del proveedor:
   - Stripe:        https://sosecure.site/api/premium/webhook
   - Mercado Pago:  misma URL (se manda como notification_url al crear la preferencia)

  Nota sobre seguridad: en producción verifica la firma del webhook
  (Stripe-Signature / x-signature de Mercado Pago).
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PREMIUM_PLAN } from '@/lib/plan-config'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

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
    const body = await req.json().catch(() => ({} as any))

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

    return NextResponse.json({ received: true, ignored: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Mercado Pago a veces hace GET de validación
export async function GET() {
  return NextResponse.json({ ok: true })
}
