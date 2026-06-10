/*
  POST /api/family/invite
  Invita a uno o varios miembros al plan familiar del usuario autenticado.
  - Crea (o reutiliza) la fila en family_members con estado 'invited'.
  - Envía un correo con un enlace para aceptar la invitación.
  El límite de 5 miembros lo garantiza el trigger en la base de datos.

  Body: { members: { name?: string; email: string }[] }
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { FAMILY_PLAN } from '@/lib/plan-config'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure.site'

interface InviteInput {
  name?: string
  email: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { members } = (await req.json()) as { members: InviteInput[] }
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'Sin miembros para invitar' }, { status: 400 })
    }

    // Grupo del dueño (debe existir; lo crea la UI antes de invitar)
    const { data: group } = await supabase
      .from('family_groups')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Primero crea tu plan familiar' }, { status: 400 })
    }

    const inviterName =
      user.user_metadata?.full_name || user.email || 'Un familiar'

    const results: { email: string; ok: boolean; reason?: string }[] = []

    for (const m of members) {
      const email = (m.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        results.push({ email: m.email, ok: false, reason: 'Correo inválido' })
        continue
      }

      // ¿Ya existe en el grupo?
      const { data: existing } = await supabase
        .from('family_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('email', email)
        .maybeSingle()

      let member = existing

      if (!member) {
        const { data: inserted, error: insErr } = await supabase
          .from('family_members')
          .insert({
            group_id: group.id,
            email,
            name: m.name ?? null,
            role: 'member',
            status: 'invited',
          })
          .select('*')
          .single()

        if (insErr || !inserted) {
          // El trigger lanza error si se supera el límite de 5
          results.push({
            email,
            ok: false,
            reason: insErr?.message?.includes('límite')
              ? 'El plan ya tiene 5 miembros'
              : (insErr?.message ?? 'No se pudo invitar'),
          })
          continue
        }
        member = inserted
      } else if (member.status === 'removed') {
        await supabase
          .from('family_members')
          .update({ status: 'invited', name: m.name ?? member.name })
          .eq('id', member.id)
      }

      const acceptLink = `${BASE_URL}/plan-familiar/aceptar/?token=${member.invite_token}`

      // Enviar correo (si Resend está configurado)
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SOSecure <alerts@sosecure.site>',
            to: email,
            subject: `🛡️ ${inviterName} te invitó al Plan Familiar de SOSecure`,
            html: inviteEmailHtml({
              inviterName,
              memberName: m.name ?? '',
              acceptLink,
            }),
          }),
        }).catch(() => {/* no romper el flujo si falla el correo */})
      }

      results.push({ email, ok: true })
    }

    return NextResponse.json({ success: true, results, link_base: BASE_URL })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function inviteEmailHtml(p: { inviterName: string; memberName: string; acceptLink: string }): string {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">
    <div style="background:#0f766e;color:#fff;padding:28px 24px;border-radius:14px 14px 0 0;text-align:center;">
      <div style="font-size:30px;">🛡️</div>
      <h1 style="margin:8px 0 0;font-size:22px;">Plan Familiar SOSecure</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:14px;">${FAMILY_PLAN.tagline}</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px;">
      <p style="color:#374151;font-size:16px;">Hola ${p.memberName || ''},</p>
      <p style="color:#374151;line-height:1.6;">
        <strong>${p.inviterName}</strong> te agregó a su Plan Familiar de SOSecure.
        Al unirte tendrás acceso completo a la app: botón SOS, ubicación en
        tiempo real, video en vivo, asistente médico y contactos de emergencia,
        sin costo para ti.
      </p>
      <div style="text-align:center;margin:26px 0;">
        <a href="${p.acceptLink}"
           style="background:#0f766e;color:#fff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Unirme al plan familiar
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;line-height:1.5;">
        Si no reconoces esta invitación, ignora este correo.<br>
        Enviado automáticamente por <strong>SOSecure</strong>.
      </p>
    </div>
  </div>`
}
