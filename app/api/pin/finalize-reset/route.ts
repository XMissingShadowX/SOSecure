import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/pin/finalize-reset — llamado desde /auth/callback tras un login
// exitoso. Si el usuario tenía un reset de PIN pendiente (solicitado desde
// la pantalla de bloqueo), recién aquí se borra el PIN de verdad — nunca
// antes de que el Magic Link se haya usado.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // admin(): `pin_reset_pending` también tiene SELECT revocado para
  // authenticated/anon (ver migración 20240014_revoke_pin_hash_select.sql).
  const { data: profile } = await admin()
    .from('profiles')
    .select('pin_reset_pending')
    .eq('id', user.id)
    .single()

  if (!profile?.pin_reset_pending) {
    return NextResponse.json({ cleared: false })
  }

  const { error } = await admin()
    .from('profiles')
    .update({ pin_hash: null, pin_enabled: false, pin_reset_pending: false })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cleared: true })
}
