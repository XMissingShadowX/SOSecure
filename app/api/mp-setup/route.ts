// Ruta temporal para crear planes MP vía API. ELIMINAR después de ejecutar.
import { NextResponse } from 'next/server'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'

export async function GET() {
  if (!MP_ACCESS_TOKEN) return NextResponse.json({ error: 'MP no configurado' }, { status: 500 })

  const plans = [
    {
      key: 'premium',
      reason: 'SOSecure Premium',
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 59,
      back_url: `${BASE_URL}/plan-premium/pago/`,
    },
    {
      key: 'familiar',
      reason: 'SOSecure Plan Familiar',
      frequency: 12,
      frequency_type: 'months',
      transaction_amount: 499,
      back_url: `${BASE_URL}/plan-familiar/pago/`,
    },
  ]

  const results: Record<string, unknown> = {}
  for (const plan of plans) {
    const res = await fetch('https://api.mercadopago.com/preapproval_plan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: plan.reason,
        auto_recurring: {
          frequency: plan.frequency,
          frequency_type: plan.frequency_type,
          transaction_amount: plan.transaction_amount,
          currency_id: 'MXN',
        },
        payment_methods_allowed: {
          payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
          payment_methods: [],
        },
        back_url: plan.back_url,
      }),
    })
    const data = await res.json()
    results[plan.key] = { id: data.id, status: data.status, error: data.message }
  }
  return NextResponse.json(results)
}
