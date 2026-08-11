import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthedUser } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { validateJsonContentType } from '@/lib/api-validation'
import { APP_URL } from '@/lib/app-url'

const OLD_SHA256_HASH = /^[0-9a-f]{64}$/i

// La fila en `profiles` no siempre existe (el trigger de registro solo crea
// una fila en `user_profiles`, una tabla distinta) y no hay política RLS de
// INSERT — el cliente con sesión de usuario no puede crear la fila.
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Solo para signInWithOtp — no necesita la sesión del usuario, solo la anon key.
function anon() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/pin — read PIN config without ever exposing pin_hash to the client
export async function GET(req: Request) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // admin(), no el cliente de sesión: `pin_hash` tiene SELECT revocado para
  // authenticated/anon a nivel de columna en Postgres (ver migración
  // 20240014_revoke_pin_hash_select.sql) — cualquier cliente con la anon key
  // podría leer el hash de cualquier usuario directo desde el navegador si
  // esto no estuviera bloqueado ahí, sin pasar por esta API en absoluto.
  const { data: profile } = await admin()
    .from('profiles')
    .select('pin_enabled, pin_hash, pin_timeout_minutes')
    .eq('id', user.id)
    .single()

  // Hash del esquema viejo (SHA-256 sin salt real) — tratarlo como no configurado.
  const pin_configured = !!profile?.pin_hash && !OLD_SHA256_HASH.test(profile.pin_hash)

  return NextResponse.json({
    pin_enabled: profile?.pin_enabled ?? false,
    pin_configured,
    pin_timeout_minutes: profile?.pin_timeout_minutes ?? 5,
  })
}

// POST /api/pin — save or update PIN config
export async function POST(req: Request) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ctErr = validateJsonContentType(req)
  if (ctErr) return ctErr

  const body = await req.json()
  const { pin, pin_enabled, pin_timeout_minutes } = body

  const update: Record<string, unknown> = {}
  if (typeof pin === 'string' && pin) {
    update.pin_hash = await bcrypt.hash(pin, 12)
    update.pin_reset_pending = false // configurar un PIN nuevo cancela cualquier reset pendiente
  }
  if (pin_enabled !== undefined) update.pin_enabled = pin_enabled
  if (pin_timeout_minutes !== undefined) update.pin_timeout_minutes = pin_timeout_minutes

  const { error } = await admin()
    .from('profiles')
    .upsert({ id: user.id, ...update }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, pin_configured: typeof update.pin_hash === 'string' ? true : undefined })
}

// DELETE /api/pin — request PIN reset (used in forgot-PIN flow)
// No borra el PIN todavía — solo lo marca como pendiente. El borrado real
// ocurre en POST /api/pin/finalize-reset, cuando el usuario efectivamente
// hace clic en el Magic Link del correo (ver app/auth/callback/page.tsx).
export async function DELETE(req: Request) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await admin()
    .from('profiles')
    .upsert({ id: user.id, pin_reset_pending: true }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send magic link so user can confirm the request by logging in fresh.
  // emailRedirectTo debe apuntar a /auth/callback — sin esto, Supabase usa
  // la Site URL por defecto y el link nunca pasa por finalize-reset.
  await anon().auth.signInWithOtp({
    email: user.email!,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${APP_URL}/auth/callback`,
    },
  })

  return NextResponse.json({ ok: true })
}
