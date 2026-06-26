/*
  POST /api/premium/cancel
  Cancela la suscripción premium del usuario autenticado.
*/

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

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

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = admin()
    const { data: sub } = await db
      .from('premium_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
    if (sub.status === 'cancelled') return NextResponse.json({ error: 'La suscripción ya está cancelada' }, { status: 400 })

    // Cancelar en el proveedor
    if (sub.provider === 'mercadopago' && sub.provider_ref && MP_ACCESS_TOKEN) {
      await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_ref}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })
    }

    if (sub.provider === 'paypal' && sub.provider_ref && PAYPAL_CLIENT_ID) {
      const token = await getPayPalToken()
      await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${sub.provider_ref}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelado por el usuario' }),
      })
    }

    await db.from('premium_subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', sub.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
