/*
  POST /api/inbound
  Webhook de Resend para correo entrante (Inbound). Configurar en Resend →
  Webhooks → evento `email.received`, apuntando a esta ruta.

  El paquete `resend` no expone (todavía) métodos de recepción — no existe
  `resend.webhooks.verify` ni `resend.emails.receiving.get` en el SDK actual, y de
  hecho este proyecto no usa el SDK en absoluto (ver /api/family/invite, que llama a
  la API REST de Resend con fetch). Por eso aquí:
    - la firma se verifica con `svix` directo (es la misma librería que usa Resend
      por debajo para firmar sus webhooks)
    - el contenido completo (html/text) se trae con fetch a la API REST de Resend,
      porque el payload del webhook solo trae metadatos (from/to/subject/email_id)

  Todo correo a *@sosecure.site (o *@inbound.sosecure.site, según cómo se configure
  el MX) llega aquí sin importar el destinatario exacto — el enrutamiento por `to`
  se hace en este handler, no en Resend.
*/

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface ResendInboundEvent {
  type: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject?: string
  }
}

export async function POST(req: NextRequest) {
  if (!RESEND_WEBHOOK_SECRET) {
    console.error('RESEND_WEBHOOK_SECRET no configurado')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }

  const payload = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing signature headers' }, { status: 400 })
  }

  let event: ResendInboundEvent
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as unknown as ResendInboundEvent
  } catch {
    // Firma inválida: no confiar en el payload. Igual que con los endpoints sin
    // autenticar señalados en la auditoría, un webhook público es superficie de
    // ataque si no se verifica.
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const { email_id, from, to, subject } = event.data
  const toAddress = to?.[0] ?? ''

  // Enrutamiento por destinatario. soporte@ y contacto@ son alias del mismo
  // buzón — cualquier otra dirección del dominio se ignora (se acepta igual en
  // Resend porque el MX recibe todo el dominio, pero no generamos ticket para ella).
  const toLower = toAddress.toLowerCase()
  if (!toLower.startsWith('soporte@') && !toLower.startsWith('contacto@')) {
    return NextResponse.json({ ok: true, ignored: 'unrouted recipient' })
  }

  // El webhook no trae el cuerpo del correo, solo metadatos — hay que pedirlo
  // aparte a la API REST de Resend.
  let textBody: string | null = null
  let htmlBody: string | null = null
  if (RESEND_API_KEY) {
    try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${email_id}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      })
      if (res.ok) {
        const full = await res.json()
        textBody = full.text ?? null
        htmlBody = full.html ?? null
      } else {
        console.error('Error obteniendo contenido del correo:', res.status, await res.text())
      }
    } catch (err) {
      console.error('Error llamando a la API de received emails:', err)
    }
  }

  const supabase = admin()
  const { error } = await supabase.from('support_tickets').upsert(
    {
      resend_email_id: email_id,
      from_address: from,
      to_address: toAddress,
      subject: subject ?? null,
      text_body: textBody,
      html_body: htmlBody,
    },
    { onConflict: 'resend_email_id' }
  )

  if (error) {
    console.error('Error guardando ticket de soporte:', error)
    return NextResponse.json({ error: 'db error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
