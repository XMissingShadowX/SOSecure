'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmergencyContact } from '@/lib/types'

/** Devuelve map de email → user_id para los contactos que tienen cuenta SOSecure */
export function useContactUserIds(contacts: EmergencyContact[]) {
  const [idMap, setIdMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const emails = contacts.map(c => (c as any).email).filter(Boolean) as string[]
    if (emails.length === 0) return

    const supabase = createClient()
    Promise.all(
      emails.map(async email => {
        const { data } = await supabase.rpc('get_user_id_by_email', { p_email: email })
        return data ? { email, userId: data as string } : null
      })
    ).then(results => {
      const map: Record<string, string> = {}
      results.forEach(r => { if (r) map[r.email] = r.userId })
      setIdMap(map)
    })
  }, [contacts.length])

  const contactUserIds = Object.values(idMap)

  /** Dado un user_id, devuelve el nombre del contacto */
  const nameFor = (userId: string): string => {
    const email = Object.keys(idMap).find(e => idMap[e] === userId)
    if (!email) return 'Contacto'
    return contacts.find(c => (c as any).email === email)?.name ?? 'Contacto'
  }

  return { contactUserIds, nameFor }
}
