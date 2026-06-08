import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa service role para saltarse RLS — el token valida la identidad del miembro
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { memberId, token, latitude, longitude, isStopping } = await req.json()

    if (!memberId || !token) {
      return NextResponse.json({ error: 'memberId y token son requeridos' }, { status: 400 })
    }

    // Validar que el token corresponda al miembro
    const { data: member, error: fetchErr } = await supabaseAdmin
      .from('tracking_members')
      .select('id, external_token, session_id')
      .eq('id', memberId)
      .eq('external_token', token)
      .single()

    if (fetchErr || !member) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
    }

    if (isStopping) {
      await supabaseAdmin
        .from('tracking_members')
        .update({ is_sharing: false })
        .eq('id', memberId)
      return NextResponse.json({ success: true })
    }

    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'latitude y longitude son requeridos' }, { status: 400 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tracking_members')
      .update({
        latitude,
        longitude,
        updated_at: new Date().toISOString(),
        is_sharing: true,
      })
      .eq('id', memberId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
