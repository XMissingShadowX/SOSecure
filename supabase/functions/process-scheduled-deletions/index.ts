// Edge Function: process-scheduled-deletions
//
// Borra permanentemente las cuentas cuyo periodo de gracia de 30 días ya
// se cumplió (profiles.scheduled_deletion_at <= now()). Es el reemplazo
// del borrado inmediato que antes hacía POST /api/delete-account — ahora
// esa ruta solo agenda (ver app/api/delete-account/route.ts); esta función
// es la única que efectivamente llama admin.auth.admin.deleteUser().
//
// Pensada para dispararse por cron, no por el cliente. Se autentica con un
// secreto propio (CRON_SECRET) además de service role interno, para que no
// sea invocable por cualquiera que adivine la URL pública de la función —
// a diferencia de las rutas normales de Next.js, las Edge Functions con
// --no-verify-jwt (necesario para que pg_cron/HTTP externo la llame) quedan
// abiertas a internet sin ese chequeo.
//
// Desplegar con: supabase functions deploy process-scheduled-deletions --no-verify-jwt
// Programar con: ver supabase/migrations/20240016_cron_process_scheduled_deletions.sql
//
// Variables de entorno requeridas (se configuran con `supabase secrets set`,
// no van en este archivo):
//   SUPABASE_URL              — ya la inyecta el runtime de Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY — ya la inyecta el runtime de Edge Functions
//   CRON_SECRET                — string propio, el mismo que se manda en el
//                                 header X-Cron-Secret desde el cron job

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const providedSecret = req.headers.get('X-Cron-Secret')

  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: dueProfiles, error: queryError } = await admin
    .from('profiles')
    .select('id, scheduled_deletion_at')
    .not('scheduled_deletion_at', 'is', null)
    .lte('scheduled_deletion_at', new Date().toISOString())

  if (queryError) {
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: { id: string; deleted: boolean; error?: string }[] = []

  for (const profile of dueProfiles ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(profile.id)
    // deleteUser en cascada se lleva la fila de profiles junto con el resto
    // de las tablas con FK a auth.users(id) on delete cascade — no hace
    // falta un DELETE aparte sobre profiles.
    results.push({
      id: profile.id,
      deleted: !deleteError,
      ...(deleteError ? { error: deleteError.message } : {}),
    })
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      deleted: results.filter(r => r.deleted).length,
      failed: results.filter(r => !r.deleted),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
