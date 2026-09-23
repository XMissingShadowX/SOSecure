/*
  GET  /api/admin/support-tickets     — lista los tickets (soporte@ / contacto@)
  PATCH /api/admin/support-tickets    — marca un ticket como cerrado/abierto

  `support_tickets` no tiene políticas RLS para authenticated/anon (ver migración
  20240017_support_tickets.sql) — solo el admin client puede leerla/escribirla, así
  que esta ruta hace de puente: valida sesión + rol de admin (mismo RPC `is_admin`
  que ya usa app/admin/page.tsx para incidentes) y recién ahí usa el admin client.
*/

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAuthedUser, getRequestScopedClient } from '@/lib/supabase/server'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin(req: Request) {
  const user = await getAuthedUser(req)
  if (!user) return null
  const scoped = await getRequestScopedClient(req)
  const { data: isAdmin } = await scoped.rpc('is_admin', { uid: user.id })
  return isAdmin ? user : null
}

export async function GET(req: Request) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await admin()
    .from('support_tickets')
    .select('id, from_address, to_address, subject, text_body, html_body, status, received_at')
    .order('received_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

export async function PATCH(req: Request) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, status } = await req.json()
  if (!id || (status !== 'open' && status !== 'closed')) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error } = await admin().from('support_tickets').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
