/*
  Helpers de cliente para el Plan Familiar.
  Encapsulan las consultas a Supabase para que la UI (ajustes / página de
  pago) no repita lógica. Todas usan el cliente del navegador con RLS.
*/

import { createClient } from '@/lib/supabase/client'
import { FAMILY_PLAN } from '@/lib/plan-config'

export type FamilyStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired'
export type MemberStatus = 'invited' | 'active' | 'removed'
export type MemberRole = 'owner' | 'member'

export interface FamilyGroup {
  id: string
  owner_id: string
  name: string
  plan_id: string
  status: FamilyStatus
  max_members: number
  provider: string | null
  provider_ref: string | null
  amount_cents: number | null
  currency: string
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  id: string
  group_id: string
  user_id: string | null
  email: string
  name: string | null
  role: MemberRole
  status: MemberStatus
  invite_token: string
  invited_at: string
  joined_at: string | null
}

/** Devuelve el grupo del que el usuario es DUEÑO (o null si no tiene). */
export async function getOwnedGroup(): Promise<FamilyGroup | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('family_groups')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  return (data as FamilyGroup) ?? null
}

/** Crea el grupo del usuario si aún no existe y lo agrega como miembro 'owner'. */
export async function ensureOwnedGroup(): Promise<FamilyGroup | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const existing = await getOwnedGroup()
  if (existing) return existing

  const { data: group, error } = await supabase
    .from('family_groups')
    .insert({
      owner_id: user.id,
      name: 'Mi Plan Familiar',
      plan_id: FAMILY_PLAN.id,
      max_members: FAMILY_PLAN.maxMembers,
      status: 'pending',
      currency: FAMILY_PLAN.currency,
      amount_cents: FAMILY_PLAN.amountCents,
    })
    .select('*')
    .single()

  if (error || !group) return null

  // El dueño cuenta como miembro #1
  await supabase.from('family_members').insert({
    group_id: group.id,
    user_id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name ?? user.email ?? 'Titular',
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  })

  return group as FamilyGroup
}

/** Lista los miembros (no eliminados) de un grupo. */
export async function listMembers(groupId: string): Promise<FamilyMember[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('family_members')
    .select('*')
    .eq('group_id', groupId)
    .neq('status', 'removed')
    .order('invited_at', { ascending: true })

  return (data as FamilyMember[]) ?? []
}

/** Marca un miembro como eliminado (libera el cupo). No permite eliminar al dueño. */
export async function removeMember(memberId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('family_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .neq('role', 'owner')

  return { error: error?.message ?? null }
}

/** ¿El usuario actual tiene plan familiar activo (como dueño o miembro)? */
export async function hasActivePlan(): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.rpc('has_active_family_plan')
  return data === true
}
