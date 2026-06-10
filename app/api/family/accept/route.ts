/*
  POST /api/family/accept
  Vincula al usuario autenticado con una invitación de plan familiar.
  Body: { token: string }   (el invite_token de family_members)

  Usa SERVICE_ROLE_KEY para poder leer/escribir la fila del invitado, que
  aún no tiene user_id y por tanto no es visible vía RLS para él.
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Inicia sesión para unirte', code: 'no_auth' }, { status: 401 })
    }

    const { token } = (await req.json()) as { token?: string }
    if (!token) {
      return NextResponse.json({ error: 'Invitación inválida' }, { status: 400 })
    }

    const db = admin()

    const { data: member } = await db
      .from('family_members')
      .select('*, family_groups(*)')
      .eq('invite_token', token)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'La invitación no existe o expiró' }, { status: 404 })
    }
    if (member.status === 'removed') {
      return NextResponse.json({ error: 'Esta invitación fue cancelada' }, { status: 410 })
    }

    // Vincular al usuario actual
    const { error } = await db
      .from('family_members')
      .update({
        user_id: user.id,
        status: 'active',
        name: member.name ?? user.user_metadata?.full_name ?? user.email,
        joined_at: new Date().toISOString(),
      })
      .eq('id', member.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      group_name: member.family_groups?.name ?? 'Plan Familiar',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
