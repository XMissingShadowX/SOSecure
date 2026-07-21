'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TrackingSession, TrackingMember } from '@/lib/types'

const POLL_MS = 30_000

export interface IncomingSession {
  session: TrackingSession
  myMember: TrackingMember
  allMembers: TrackingMember[]
}

export function useIncomingTracking(currentUserId: string | null) {
  const [incoming, setIncoming] = useState<IncomingSession[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const locationRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const poll = useCallback(async () => {
    if (!currentUserId) return
    const supabase = createClient()

    // Buscar filas de tracking_members donde soy el contacto (user_id = yo, no iniciador)
    const { data: myRows } = await supabase
      .from('tracking_members')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('is_initiator', false)

    if (!myRows?.length) { setIncoming([]); return }

    // Cargar sesiones activas correspondientes
    const sessionIds = [...new Set(myRows.map((r: any) => r.session_id))]
    const { data: sessions } = await supabase
      .from('tracking_sessions')
      .select('*')
      .in('id', sessionIds)
      .eq('status', 'active')

    if (!sessions?.length) { setIncoming([]); return }

    // Para cada sesión activa cargar todos los miembros
    const result: IncomingSession[] = await Promise.all(
      sessions.map(async (sess: any) => {
        const myMember = myRows.find((r: any) => r.session_id === sess.id)!
        const { data: allMembers } = await supabase
          .from('tracking_members')
          .select('*')
          .eq('session_id', sess.id)
        return {
          session: sess as TrackingSession,
          myMember: myMember as TrackingMember,
          allMembers: (allMembers ?? []) as TrackingMember[],
        }
      })
    )

    setIncoming(result)
  }, [currentUserId])

  // Iniciar/detener compartir ubicación para una sesión entrante
  const shareLocation = useCallback(async (memberId: string, token: string) => {
    if (locationRefs.current[memberId]) return // ya compartiendo

    const upload = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await fetch('/api/tracking-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId,
            token,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        })
        // Refrescar para que el indicador se actualice
        poll()
      }, undefined, { enableHighAccuracy: true, timeout: 10000 })
    }

    upload()
    locationRefs.current[memberId] = setInterval(upload, POLL_MS)
  }, [poll])

  const stopShare = useCallback(async (memberId: string, token: string) => {
    if (locationRefs.current[memberId]) {
      clearInterval(locationRefs.current[memberId])
      delete locationRefs.current[memberId]
    }
    await fetch('/api/tracking-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, token, isStopping: true }),
    })
    poll()
  }, [poll])

  useEffect(() => {
    if (!currentUserId) return
    poll()
    pollRef.current = setInterval(poll, POLL_MS)

    // Refresco inmediato vía Realtime (el polling de arriba queda como respaldo
    // por si la replicación de Realtime no está habilitada para esta tabla).
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`incoming-tracking-${currentUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tracking_members', filter: `user_id=eq.${currentUserId}` },
          () => poll()
        )
        .subscribe()
    } catch { /* noop: el polling sigue funcionando igual */ }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      Object.values(locationRefs.current).forEach(clearInterval)
      if (channel) { try { createClient().removeChannel(channel) } catch { /* noop */ } }
    }
  }, [currentUserId, poll])

  return { incoming, shareLocation, stopShare }
}
