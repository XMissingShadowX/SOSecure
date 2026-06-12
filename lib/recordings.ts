/*
  * Este módulo define funciones relacionadas con la gestión de grabaciones de audio y video en la aplicación SOSecure.
  * Incluye la generación de identificadores únicos para las grabaciones, la descarga local de las grabaciones, el envío 
  * de las grabaciones a los contactos de emergencia a través de diferentes métodos (como la API de Compartir del navegador o WhatsApp), 
  * y la subida de las grabaciones a la base de datos de Supabase. Estas funciones son esenciales para permitir a los 
  * usuarios compartir evidencia visual o auditiva en situaciones de emergencia, facilitando así una respuesta más 
  * rápida y efectiva por parte de sus contactos de confianza.
*/

// Importar la función `createClient` del módulo de Supabase para interactuar con la base de datos y el almacenamiento 
// de Supabase.
import { createClient } from '@/lib/supabase/client'
import type { EmergencyContact } from '@/lib/types'

// Definir el tipo `RecordingType` que puede ser 'audio' o 'video', y la interfaz `RecordingMeta` que describe los 
// metadatos de una grabación,
export type RecordingType = 'audio' | 'video'

// La interfaz `RecordingMeta` describe los metadatos asociados a una grabación, incluyendo su identificador, 
// blob de datos, tipo, tipo MIME, duración, fecha de creación, ubicación geográfica opcional y un identificador de alerta 
// SOS opcional.
export interface RecordingMeta {
  id: string
  blob: Blob
  type: RecordingType
  mimeType: string
  durationMs: number
  createdAt: string
  latitude?: number
  longitude?: number
  sosAlertId?: string
}

// Función para generar un identificador único para cada grabación utilizando la API de Crypto del navegador o una combinación
// de la marca de tiempo y un número aleatorio como fallback.
export function generateRecordingId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Función para guardar una grabación localmente en el dispositivo del usuario, creando un enlace de descarga temporal y 
// simulando un clic para iniciar la descarga.
export function saveRecordingLocally(meta: RecordingMeta): string {
  const ext = meta.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const filename = `safewalk-${meta.type}-${meta.id}.${ext}`
  const url = URL.createObjectURL(meta.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1000)
  return filename
}

// Función para enviar una grabación a los contactos de emergencia utilizando diferentes métodos, como la API de 
// Compartir del navegador o WhatsApp,
export async function sendRecordingToContacts(
  meta: RecordingMeta,
  contacts: EmergencyContact[],
  message?: string
): Promise<{ success: boolean; method: string }> {
  if (!contacts.length) return { success: false, method: 'none' }

  const ext = meta.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const filename = `safewalk-${meta.type}-${meta.id}.${ext}`
  const file = new File([meta.blob], filename, { type: meta.mimeType })

  const shareText =
    message ??
    `🚨 ALERTA SOSecure — ${new Date(meta.createdAt).toLocaleString('es-MX')}` +
    (meta.latitude ? `\n📍 https://maps.google.com/?q=${meta.latitude},${meta.longitude}` : '')

  // Intento con Web Share API (funciona en móvil/Capacitor)
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ title: '🚨 Grabación SOSecure', text: shareText, files: [file] })
        return { success: true, method: 'share' }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') console.warn('share() falló:', err.message)
    }
  }

  // Fallback: subir a Supabase y compartir link por WhatsApp
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const storagePath = `${user.id}/${meta.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, meta.blob, { contentType: meta.mimeType, upsert: true })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(storagePath)
      const publicUrl = urlData?.publicUrl

      if (publicUrl) {
        return { success: true, method: 'url' }
      }
    }
  }

  return { success: false, method: 'none' }
}

export async function uploadRecordingToDB(meta: RecordingMeta) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { publicUrl: null, dbRecord: null, error: 'No autenticado' }

  const ext = meta.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const storagePath = `${user.id}/${meta.id}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(storagePath, meta.blob, { contentType: meta.mimeType, upsert: false })

  if (uploadError) return { publicUrl: null, dbRecord: null, error: uploadError.message }

  const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl ?? null

  const { data: dbRecord, error: dbError } = await supabase
    .from('recordings')
    .insert({
      id: meta.id,
      user_id: user.id,
      storage_path: storagePath,
      public_url: publicUrl,
      recording_type: meta.type,
      mime_type: meta.mimeType,
      duration_ms: meta.durationMs,
      file_size_bytes: meta.blob.size,
      latitude: meta.latitude ?? null,
      longitude: meta.longitude ?? null,
      sos_alert_id: meta.sosAlertId ?? null,
    })
    .select()
    .single()

  if (dbError) return { publicUrl, dbRecord: null, error: dbError.message }
  return { publicUrl, dbRecord, error: null }
}
