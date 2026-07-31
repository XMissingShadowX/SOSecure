import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthedUser } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { validateJsonContentType } from '@/lib/api-validation'

// `pin_hash` tiene SELECT revocado para authenticated/anon a nivel de
// columna (ver migración 20240014_revoke_pin_hash_select.sql) — leerlo
// requiere el service role, nunca el cliente de sesión del usuario.
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

const OLD_SHA256_HASH = /^[0-9a-f]{64}$/i

export async function POST(req: Request) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Persistido en Postgres (tabla pin_attempts, ver supabase-pin-rate-limit.sql)
  // en vez de un Map en memoria, para que el bloqueo sea real entre instancias
  // serverless y no solo por instancia.
  const { data: lockoutRows } = await admin().rpc('check_pin_lockout', { p_user_id: user.id })
  const lockout = lockoutRows?.[0]
  if (lockout?.locked) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos' }, { status: 429, headers: { 'Retry-After': String(lockout.retry_after_seconds) } })
  }

  const ctErr = validateJsonContentType(req)
  if (ctErr) return ctErr

  const { pin } = await req.json()
  if (typeof pin !== 'string' || !pin) {
    return NextResponse.json({ ok: false, error: 'PIN inválido' }, { status: 400 })
  }

  const { data: profile } = await admin()
    .from('profiles')
    .select('pin_hash, pin_enabled')
    .eq('id', user.id)
    .single()

  if (!profile?.pin_enabled || !profile.pin_hash) {
    return NextResponse.json({ ok: false, error: 'PIN no configurado' }, { status: 400 })
  }

  // Hash del esquema viejo (SHA-256 sin salt real) — tratarlo como no configurado.
  if (OLD_SHA256_HASH.test(profile.pin_hash)) {
    return NextResponse.json({ ok: false, error: 'PIN debe reconfigurarse' }, { status: 400 })
  }

  const match = await bcrypt.compare(pin, profile.pin_hash)

  await admin().rpc('record_pin_attempt', {
    p_user_id: user.id,
    p_success: match,
    p_max_attempts: MAX_ATTEMPTS,
    p_lockout_seconds: LOCKOUT_SECONDS,
  })

  if (!match) {
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
