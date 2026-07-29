'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'

const POLL_MS = 30_000

export interface LiveContact {
  user_id: string
  display_name: string
  latitude: number
  longitude: number
  updated_at: string
  is_sharing: boolean
}

export function useLiveLocation(options: {
  currentUserId: string | null
  currentUserName: string | null
  contactUserIds: string[]
}) {
  const { currentUserId, contactUserIds } = options
  const { isLiveSharing, setIsLiveSharing } = useAppStore()
  const [contacts, setContacts] = useState<LiveContact[]>([])
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Leer ubicaciones de los contactos (polling)
  const pollContacts = useCallback(async () => {
    if (!currentUserId || contactUserIds.length === 0) return
    const supabase = createClient()
    const { data } = await supabase
      .from('user_locations')
      .select('*')
      .in('user_id', contactUserIds)
      .eq('is_sharing', true)
    if (data) setContacts(data as LiveContact[])
  }, [currentUserId, contactUserIds])

  // Leer mi ubicación actual desde Supabase (para mostrar en el mapa)
  useEffect(() => {
    if (!currentUserId || !isLiveSharing) { setMyLocation(null); return }
    const supabase = createClient()
    supabase
      .from('user_locations')
      .select('latitude, longitude')
      .eq('user_id', currentUserId)
      .single()
      .then(({ data }) => {
        if (data?.latitude) setMyLocation({ latitude: data.latitude, longitude: data.longitude })
      })
  }, [currentUserId, isLiveSharing])

  // Toggle: solo cambia el flag en el store. El broadcasting real está en AppShell.
  const toggleSharing = useCallback(async () => {
    if (!currentUserId) return
    const next = !isLiveSharing
    setIsLiveSharing(next)
    if (!next) {
      // Marcar como no compartiendo en Supabase
      const supabase = createClient()
      await supabase
        .from('user_locations')
        .update({ is_sharing: false })
        .eq('user_id', currentUserId)
      setMyLocation(null)
    }
  }, [currentUserId, isLiveSharing, setIsLiveSharing])

  // Polling de contactos
  useEffect(() => {
    if (!currentUserId || contactUserIds.length === 0) return
    pollContacts()
    pollRef.current = setInterval(pollContacts, POLL_MS)

    // Refresco inmediato vía Realtime (el polling de arriba queda como respaldo
    // por si la replicación de Realtime no está habilitada para esta tabla).
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`live-location-contacts-${currentUserId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, () => pollContacts())
        .subscribe()
    } catch { /* noop: el polling sigue funcionando igual */ }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (channel) { try { createClient().removeChannel(channel) } catch { /* noop */ } }
    }
  }, [currentUserId, pollContacts, contactUserIds.length])

  return { isSharingMyLocation: isLiveSharing, toggleSharing, contacts, myLocation }
}
