import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
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
const LOCKOUT_MS = 1 * 60 * 1000

// Placeholder de rate limiting en memoria — NO persiste entre instancias serverless.
// En producción reemplazar por Redis/Upstash (o similar) compartido entre instancias.
const attemptsByUser = new Map<string, { count: number; lockedUntil: number | null }>()

const OLD_SHA256_HASH = /^[0-9a-f]{64}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const entry = attemptsByUser.get(user.id)
  if (entry?.lockedUntil && Date.now() < entry.lockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000)
    return NextResponse.json({ ok: false, error: 'Demasiados intentos' }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } })
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

  if (!match) {
    const next = { count: (entry?.count ?? 0) + 1, lockedUntil: null as number | null }
    if (next.count >= MAX_ATTEMPTS) {
      next.lockedUntil = Date.now() + LOCKOUT_MS
    }
    attemptsByUser.set(user.id, next)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  attemptsByUser.delete(user.id)
  return NextResponse.json({ ok: true })
}
