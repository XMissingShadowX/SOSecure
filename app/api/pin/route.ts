import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/pin — save or update PIN config
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { pin_hash, pin_enabled, pin_timeout_minutes } = body

  const update: Record<string, unknown> = {}
  if (pin_hash !== undefined) update.pin_hash = pin_hash
  if (pin_enabled !== undefined) update.pin_enabled = pin_enabled
  if (pin_timeout_minutes !== undefined) update.pin_timeout_minutes = pin_timeout_minutes

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/pin — clear PIN (used in forgot-PIN flow)
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({ pin_hash: null, pin_enabled: false })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send magic link so user can log in fresh and set a new PIN
  await supabase.auth.signInWithOtp({
    email: user.email!,
    options: { shouldCreateUser: false },
  })

  return NextResponse.json({ ok: true })
}
