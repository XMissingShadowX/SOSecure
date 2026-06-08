'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TrackingSession, TrackingMember } from '@/lib/types'

const LOCATION_INTERVAL_MS = 30_000

export interface StartTrackingOptions {
  initiatorName: string
  initiatorUserId: string
  contacts: Array<{ id: string; name: string; email?: string; phone?: string }>
  securityTimerEnd?: number | null
}

export function useTracking() {
  const [session, setSession] = useState<TrackingSession | null>(null)
  const [members, setMembers] = useState<TrackingMember[]>([])
  const [myMemberId, setMyMemberId] = useState<string | null>(null)
  const [myMemberToken, setMyMemberToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopIntervals = useCallback(() => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    locationIntervalRef.current = null
    pollIntervalRef.current = null
  }, [])

  // Sube la ubicación del iniciador vía API server-side (mismo camino que el contacto)
  const uploadMyLocation = useCallback(async (memberId: string, memberToken: string) => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch('/api/tracking-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          token: memberToken,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      })
    }, undefined, { enableHighAccuracy: true, timeout: 10000 })
  }, [])

  // Polling para leer posiciones de todos los miembros
  const pollMembers = useCallback(async (sessionId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tracking_members')
      .select('*')
      .eq('session_id', sessionId)
    if (data) setMembers(data as TrackingMember[])
  }, [])

  const startTracking = useCallback(async (opts: StartTrackingOptions) => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // 1. Crear sesión
      const { data: sess, error: sessErr } = await supabase
        .from('tracking_sessions')
        .insert({
          initiator_user_id: opts.initiatorUserId,
          initiator_name: opts.initiatorName,
          status: 'active',
          security_timer_end: opts.securityTimerEnd ?? null,
        })
        .select()
        .single()

      if (sessErr || !sess) throw new Error(sessErr?.message ?? 'No se pudo crear la sesión')
      setSession(sess as TrackingSession)

      // 2. Crear fila del iniciador
      const { data: myRow, error: myErr } = await supabase
        .from('tracking_members')
        .insert({
          session_id: sess.id,
          display_name: opts.initiatorName,
          is_initiator: true,
          external_token: crypto.randomUUID(),
          is_sharing: true,
        })
        .select()
        .single()

      if (myErr || !myRow) throw new Error('No se pudo crear el miembro iniciador')
      setMyMemberId(myRow.id)
      setMyMemberToken(myRow.external_token)

      // 3. Resolver user_id de contactos con cuenta SOSecure (por email)
      const resolvedUserIds: Record<string, string | null> = {}
      await Promise.all(
        opts.contacts
          .filter(c => c.email)
          .map(async c => {
            const { data } = await supabase.rpc('get_user_id_by_email', { p_email: c.email })
            resolvedUserIds[c.id] = data ?? null
          })
      )

      // 4. Crear filas para cada contacto con token único y user_id si tiene cuenta
      const contactRows = opts.contacts.map(c => ({
        session_id: sess.id,
        display_name: c.name,
        is_initiator: false,
        external_token: crypto.randomUUID(),
        is_sharing: false,
        user_id: resolvedUserIds[c.id] ?? null,
      }))

      const { data: insertedContacts } = await supabase
        .from('tracking_members')
        .insert(contactRows)
        .select()

      // 5. Enviar invitaciones por email solo a contactos SIN cuenta SOSecure
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const invites = (insertedContacts ?? [])
        .map((row: any, i: number) => ({
          name: opts.contacts[i]?.name ?? row.display_name,
          email: opts.contacts[i]?.email,
          phone: opts.contacts[i]?.phone,
          link: `${origin}/tracking/${sess.id}?member=${row.id}&token=${row.external_token}`,
          hasAccount: !!resolvedUserIds[opts.contacts[i]?.id],
        }))
        .filter(inv => inv.email && !inv.hasAccount)

      if (invites.length > 0) {
        await fetch('/api/tracking-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initiatorName: opts.initiatorName,
            invites,
            securityTimerEnd: opts.securityTimerEnd ?? null,
          }),
        })
      }

      // 5. Iniciar intervalos
      uploadMyLocation(myRow.id, myRow.external_token)
      locationIntervalRef.current = setInterval(() => uploadMyLocation(myRow.id, myRow.external_token), LOCATION_INTERVAL_MS)

      pollMembers(sess.id)
      pollIntervalRef.current = setInterval(() => pollMembers(sess.id), LOCATION_INTERVAL_MS)

    } catch (err: any) {
      setError(err.message ?? 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [uploadMyLocation, pollMembers])

  const stopTracking = useCallback(async () => {
    stopIntervals()
    if (!session) return
    const supabase = createClient()
    await supabase
      .from('tracking_sessions')
      .update({ status: 'stopped' })
      .eq('id', session.id)
    if (myMemberId && myMemberToken) {
      await fetch('/api/tracking-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: myMemberId, token: myMemberToken, isStopping: true }),
      })
    }
    setSession(null)
    setMembers([])
    setMyMemberId(null)
    setMyMemberToken(null)
  }, [session, myMemberId, myMemberToken, stopIntervals])

  // Actualiza security_timer_end en la sesión activa cuando cambia el temporizador
  const syncTimer = useCallback(async (timerEnd: number | null) => {
    if (!session) return
    const supabase = createClient()
    await supabase
      .from('tracking_sessions')
      .update({ security_timer_end: timerEnd })
      .eq('id', session.id)
    setSession(prev => prev ? { ...prev, security_timer_end: timerEnd } : prev)
  }, [session])

  // Limpieza al desmontar
  useEffect(() => () => stopIntervals(), [stopIntervals])

  return {
    session,
    members,
    myMemberId,
    loading,
    error,
    startTracking,
    stopTracking,
    syncTimer,
  }
}
