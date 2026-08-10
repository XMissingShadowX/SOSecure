/*
  POST /api/family/cancel
  Cancela la suscripción del plan familiar del usuario autenticado.
  - En MP: llama PATCH /preapproval/{id} con status: cancelled
  - En PayPal: llama POST /v1/billing/subscriptions/{id}/cancel
  - Siempre marca el grupo como 'cancelled' en Supabase
*/

import { NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/supabase/server'
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

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = admin()
    const { data: group } = await db
      .from('family_groups')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    if (group.status === 'cancelled') return NextResponse.json({ error: 'El plan ya está cancelado' }, { status: 400 })

    // Cancelar en el proveedor
    if (group.provider === 'mercadopago' && group.provider_ref && MP_ACCESS_TOKEN) {
      await fetch(`https://api.mercadopago.com/preapproval/${group.provider_ref}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })
    }

    if (group.provider === 'paypal' && group.provider_ref && PAYPAL_CLIENT_ID) {
      const token = await getPayPalToken()
      await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${group.provider_ref}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelado por el usuario' }),
      })
    }

    // Marcar como cancelado en Supabase
    await db.from('family_groups')
      .update({ status: 'cancelled' })
      .eq('id', group.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
