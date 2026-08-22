import { getAuthedUserWithToken } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const GRACE_PERIOD_DAYS = 30

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Ya no borra la cuenta al instante — la agenda para dentro de 30 días
// (scheduled_deletion_at) y cierra la sesión del usuario en todos sus
// dispositivos. El borrado real lo hace la Edge Function
// process-scheduled-deletions, disparada por cron. Si el usuario vuelve a
// iniciar sesión antes del plazo, POST /api/delete-account/cancel limpia
// scheduled_deletion_at y la cuenta sobrevive.
//
// Único llamador: app/solicitar-eliminacion/confirmar/page.tsx, tras
// verificar el Magic Link (exchangeCodeForSession). El botón de Ajustes →
// Cuenta → Eliminar cuenta (components/app-shell.tsx) ya no llama esta ruta
// directo — redirige a /solicitar-eliminacion para forzar el mismo paso de
// confirmación por correo con o sin sesión activa.
export async function POST(req: Request) {
  const authed = await getAuthedUserWithToken(req)

  if (!authed) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { user, token } = authed

  const admin = adminClient()

  const scheduledDeletionAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // upsert con onConflict: 'id' porque profiles no se crea automáticamente
  // al registrarse (ver CLAUDE.md) — un .update() silencioso de 0 filas
  // dejaría la cuenta sin agendar y sin ningún error visible.
  const { error: updateError } = await admin
    .from('profiles')
    .upsert({ id: user.id, scheduled_deletion_at: scheduledDeletionAt }, { onConflict: 'id' })

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // scope: 'global' revoca, a partir del token de ESTA sesión, los refresh
  // tokens de TODAS las sesiones/dispositivos del usuario (no solo la
  // actual). Los access tokens ya emitidos (JWT sin estado) siguen siendo
  // válidos hasta su expiración natural — no hay forma de revocarlos antes
  // de eso sin una tabla de deny-list, y no hace falta: durante los 30 días
  // de gracia la cuenta sigue funcionando con normalidad (ver justificación
  // en la migración/README de esta feature).
  const { error: signOutError } = await admin.auth.admin.signOut(token, 'global')
  if (signOutError) {
    // No abortamos el flujo por esto: el borrado ya quedó agendado, que es
    // lo que importa. El cliente igual redirige a /auth/login y limpia su
    // sesión local.
    console.error('No se pudo cerrar sesión global tras agendar borrado:', signOutError.message)
  }

  return Response.json({ success: true, scheduledDeletionAt })
}
