/*
  POST /api/family/webhook
  Recibe la confirmación de pago del proveedor y ACTIVA el plan familiar.
  Usa SUPABASE_SERVICE_ROLE_KEY porque corre sin sesión de usuario.

  Soporta:
   - Stripe:        evento checkout.session.completed
   - Mercado Pago:  notificación de payment (topic=payment)
   - PayPal:        evento PAYMENT.CAPTURE.COMPLETED

  Configura la URL de este webhook en el panel del proveedor:
   - Stripe:        https://sosecure.site/api/family/webhook
   - Mercado Pago:  misma URL (se manda como notification_url al crear la preferencia)
   - PayPal:        https://sosecure.site/api/family/webhook  (en Developer Dashboard → Webhooks)

  Nota sobre seguridad: en producción verifica la firma del webhook
  (Stripe-Signature / x-signature de Mercado Pago / PayPal-Transmission-Sig).
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FAMILY_PLAN } from '@/lib/plan-config'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function activateGroup(groupId: string, provider: string, ref?: string) {
  const now = new Date()
  const end = new Date(now)
  end.setFullYear(end.getFullYear() + 1)

  await admin()
    .from('family_groups')
    .update({
      status: 'active',
      provider,
      provider_ref: ref ?? null,
      amount_cents: FAMILY_PLAN.amountCents,
      currency: FAMILY_PLAN.currency,
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
    })
    .eq('id', groupId)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))

    // ── Stripe ─────────────────────────────────────────────
    if (body?.type === 'checkout.session.completed') {
      const session = body.data?.object
      const groupId = session?.metadata?.group_id || session?.client_reference_id
      if (groupId) {
        await activateGroup(groupId, 'stripe', session?.id)
      }
      return NextResponse.json({ received: true })
    }

    // ── Mercado Pago ───────────────────────────────────────
    // MP manda { type:'payment', data:{ id } }. Consultamos el pago
    // para confirmar que fue aprobado y obtener external_reference.
    if (body?.type === 'payment' && body?.data?.id && MP_ACCESS_TOKEN) {
      const paymentId = body.data.id
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })
      const payment = await res.json()
      if (payment?.status === 'approved') {
        const groupId = payment.external_reference || payment.metadata?.group_id
        if (groupId) {
          await activateGroup(groupId, 'mercadopago', String(paymentId))
        }
      }
      return NextResponse.json({ received: true })
    }

    // ── PayPal ─────────────────────────────────────────────
    if (body?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = body?.resource
      // custom_id lo pusimos en la orden al crearla
      const groupId = resource?.custom_id
        ?? resource?.purchase_units?.[0]?.custom_id
      if (groupId) {
        await activateGroup(groupId, 'paypal', resource?.id)
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
