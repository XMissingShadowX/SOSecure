import { getAuthedUser } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Se llama justo después de un login exitoso (app/auth/login/page.tsx). Si
// el usuario tenía un borrado agendado (scheduled_deletion_at) y todavía no
// se cumplió el plazo, volver a iniciar sesión lo cancela automáticamente.
// scheduled_deletion_at no está en el grant de SELECT de authenticated/anon
// (ver 20240015_scheduled_account_deletion.sql), así que la lectura y la
// limpieza se hacen con el admin client.
export async function POST(req: Request) {
  const user = await getAuthedUser(req)

  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = adminClient()

  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('scheduled_deletion_at')
    .eq('id', user.id)
    .maybeSingle()

  if (readError) {
    return Response.json({ error: readError.message }, { status: 500 })
  }

  if (!profile?.scheduled_deletion_at) {
    return Response.json({ cancelled: false })
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ scheduled_deletion_at: null })
    .eq('id', user.id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ cancelled: true })
}
