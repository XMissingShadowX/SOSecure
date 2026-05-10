import { createClient } from '@/lib/supabase/client'
import type { EmergencyContact } from '@/lib/types'

export type RecordingType = 'audio' | 'video'

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

export function generateRecordingId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function saveRecordingLocally(meta: RecordingMeta): string {
  const ext = meta.type === 'audio' ? 'webm' : 'mp4'
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

export async function sendRecordingToContacts(
  meta: RecordingMeta,
  contacts: EmergencyContact[],
  message?: string
): Promise<{ success: boolean; method: string }> {
  if (!contacts.length) return { success: false, method: 'none' }

  const ext = meta.type === 'audio' ? 'webm' : 'mp4'
  const filename = `safewalk-${meta.type}-${meta.id}.${ext}`
  const file = new File([meta.blob], filename, { type: meta.mimeType })

  const shareText =
    message ??
    `🚨 ALERTA SafeWalk — ${new Date(meta.createdAt).toLocaleString('es-MX')}` +
    (meta.latitude ? `\n📍 https://maps.google.com/?q=${meta.latitude},${meta.longitude}` : '')

  // Intento con Web Share API (funciona en móvil/Capacitor)
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: '🚨 Grabación SOSecure', text: shareText, files: [file] })
        return { success: true, method: 'share' }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') console.warn('share() falló:', err.message)
    }
  }

  // Fallback: abrir WhatsApp del contacto principal
  const primary = contacts.find(c => c.importance === 'primary') ?? contacts[0]
  const phone = primary.phone.replace(/\D/g, '')
  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
    return { success: true, method: 'whatsapp' }
  }

  return { success: false, method: 'none' }
}

export async function uploadRecordingToDB(meta: RecordingMeta) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { publicUrl: null, dbRecord: null, error: 'No autenticado' }

  const ext = meta.type === 'audio' ? 'webm' : 'mp4'
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
