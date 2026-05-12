import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const BASE_URL = 'https://sosecure-ten.vercel.app'

serve(async (req) => {
  try {
    const { alert_id, user_id, user_name, latitude, longitude, contacts } = await req.json()

    const emergencyUrl = `${BASE_URL}/emergency/${alert_id}`
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`

    const emailsToSend = contacts
      .filter((c: any) => c.email)
      .map((c: any) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SOSecure <alerts@resend.dev>',
            to: c.email,
            subject: `🚨 ALERTA SOS — ${user_name || 'Un contacto'} necesita ayuda`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#ef4444;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="margin:0;font-size:28px;">🚨 ALERTA SOS</h1>
                  <p style="margin:8px 0 0;opacity:0.9">${user_name || 'Tu contacto'} ha activado una alerta de emergencia</p>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;">
                  <p style="color:#374151;font-size:16px;">Hola ${c.name},</p>
                  <p style="color:#374151;">Tu contacto de emergencia <strong>${user_name || 'un usuario de SOSecure'}</strong> ha activado el botón SOS y puede necesitar ayuda.</p>
                  
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
                    <p style="margin:0;color:#991b1b;font-weight:bold;">📍 Ubicación inicial:</p>
                    <p style="margin:8px 0 0;color:#374151;font-family:monospace;">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
                  </div>

                  <div style="text-align:center;margin:24px 0;display:flex;flex-direction:column;gap:12px;">
                    <a href="${emergencyUrl}" style="background:#ef4444;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:block;">
                      📡 Ver ubicación en tiempo real
                    </a>
                    <a href="${mapsUrl}" style="background:#3b82f6;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:block;">
                      🗺️ Abrir en Google Maps
                    </a>
                  </div>

                  <p style="color:#6b7280;font-size:14px;text-align:center;">
                    Este email fue generado automáticamente por SOSecure.<br>
                    Si fue una falsa alarma, el usuario puede cancelar la alerta desde la app.
                  </p>
                </div>
              </div>
            `,
          }),
        })
      )

    await Promise.all(emailsToSend)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})