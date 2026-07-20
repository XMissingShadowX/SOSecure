import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hora

// `sos_alerts.video_url` guarda el storage_path del bucket privado `recordings`,
// no una URL. El visitante de /emergency/[alertId] es anónimo (sin sesión), así
// que no puede generar su propia URL firmada — este endpoint usa el admin client
// para generar una fresca en cada visita.
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params

  const { data: alert } = await admin()
    .from('sos_alerts')
    .select('video_url')
    .eq('id', alertId)
    .single()

  const storagePath = alert?.video_url
  if (!storagePath) return NextResponse.json({ error: 'No hay video' }, { status: 404 })

  const { data, error } = await admin()
    .storage
    .from('recordings')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo generar la URL del video' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
