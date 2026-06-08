import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sosecure-ten.vercel.app'

interface Invite {
  name: string
  email?: string
  link: string
}

export async function POST(req: NextRequest) {
  try {
    const { initiatorName, invites, securityTimerEnd } = await req.json() as {
      initiatorName: string
      invites: Invite[]
      securityTimerEnd: number | null
    }

    const timerText = securityTimerEnd
      ? `El temporizador de seguridad expira en ${Math.round((securityTimerEnd - Date.now()) / 60000)} minutos.`
      : ''

    const emailsToSend = invites
      .filter(inv => inv.email)
      .map(inv =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SOSecure <alerts@sosecure.site>',
            to: inv.email,
            subject: `📍 ${initiatorName} te invita a un seguimiento de seguridad`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#2563eb;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;">📍 Seguimiento de seguridad</h1>
                  <p style="margin:8px 0 0;opacity:0.9">${initiatorName} quiere que puedas ver su ubicación</p>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;">
                  <p style="color:#374151;font-size:16px;">Hola ${inv.name},</p>
                  <p style="color:#374151;">
                    <strong>${initiatorName}</strong> ha iniciado un seguimiento de seguridad y te ha enviado este enlace para que puedas ver su ubicación en tiempo real y compartir la tuya con él/ella.
                  </p>
                  ${timerText ? `
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
                    <p style="margin:0;color:#1e40af;font-weight:bold;">⏱️ Temporizador activo</p>
                    <p style="margin:6px 0 0;color:#374151;font-size:14px;">${timerText}</p>
                  </div>` : ''}
                  <div style="text-align:center;margin:24px 0;">
                    <a href="${inv.link}" style="background:#2563eb;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:block;">
                      📡 Ver seguimiento en tiempo real
                    </a>
                  </div>
                  <p style="color:#6b7280;font-size:13px;text-align:center;">
                    Al abrir el enlace, se te pedirá permiso para compartir tu ubicación.<br>
                    Puedes detener el seguimiento en cualquier momento desde la misma página.<br><br>
                    Generado automáticamente por <strong>SOSecure</strong>.
                  </p>
                </div>
              </div>
            `,
          }),
        })
      )

    await Promise.all(emailsToSend)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
