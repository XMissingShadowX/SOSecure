/*
  Sección "Plan Familiar" dentro del diálogo de Ajustes.
  - Muestra el estado de la suscripción (pendiente / activa).
  - Botón "Activar plan" que REDIRIGE a la página web de pago.
  - Cuando está activo: lista de miembros, invitar por correo y quitar.
  Usa los componentes de UI de la app para verse igual que el resto.
*/

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Crown, Mail, Trash2, Plus, BadgeCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FAMILY_PLAN, formatAmount } from '@/lib/plan-config'
import {
  ensureOwnedGroup, listMembers, removeMember,
  type FamilyGroup, type FamilyMember,
} from '@/lib/family'

export function FamilyPlanSection() {
  const [group, setGroup] = useState<FamilyGroup | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const g = await ensureOwnedGroup()
    setGroup(g)
    if (g) setMembers(await listMembers(g.id))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isActive = group?.status === 'active'
  const used = members.length
  const free = Math.max(0, FAMILY_PLAN.maxMembers - used)

  const goToPayment = () => {
    // Redirige a la página web de pago (misma app, sesión compartida)
    window.location.href = '/plan-familiar/pago/'
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email.includes('@')) { setErr('Escribe un correo válido'); return }
    if (free <= 0) { setErr('Ya alcanzaste el límite de 5 miembros'); return }
    setSending(true); setErr(null); setMsg(null)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: [{ email, name: inviteName.trim() || undefined }] }),
      })
      const data = await res.json()
      const r = data.results?.[0]
      if (data.success && r?.ok) {
        setMsg('Invitación enviada')
        setInviteEmail(''); setInviteName('')
        await refresh()
      } else {
        setErr(r?.reason ?? data.error ?? 'No se pudo invitar')
      }
    } catch {
      setErr('Error de conexión')
    }
    setSending(false)
  }

  const handleRemove = async (id: string) => {
    const { error } = await removeMember(id)
    if (error) { setErr(error); return }
    await refresh()
  }

  if (loading) {
    return (
      <div>
        <p className="text-sm font-medium mb-3">Plan Familiar</p>
        <div className="p-3 rounded-lg border border-border text-xs text-muted-foreground">Cargando…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4" />
        <p className="text-sm font-medium">Plan Familiar</p>
      </div>

      <div className="p-3 rounded-lg border border-border space-y-3">
        {/* Estado */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{FAMILY_PLAN.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatAmount(FAMILY_PLAN.amountCents)} / {FAMILY_PLAN.period} · hasta {FAMILY_PLAN.maxMembers} usuarios
            </p>
          </div>
          {isActive ? (
            <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/15 px-2 py-1 rounded-full">
              <BadgeCheck className="w-3.5 h-3.5" /> Activo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" /> Sin activar
            </span>
          )}
        </div>

        {isActive && group?.current_period_end && (
          <p className="text-xs text-muted-foreground">
            Válido hasta el {new Date(group.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        )}

        {/* Si NO está activo: invitar al pago */}
        {!isActive && (
          <>
            <p className="text-xs text-muted-foreground">
              Activa el plan para proteger a toda tu familia con una sola suscripción anual.
            </p>
            <Button className="w-full" size="sm" onClick={goToPayment}>
              Activar plan familiar — {formatAmount(FAMILY_PLAN.amountCents)}
            </Button>
          </>
        )}

        {/* Si está activo: gestión de miembros */}
        {isActive && (
          <>
            <div className="pt-1">
              <p className="text-xs font-medium mb-2">Miembros ({used}/{FAMILY_PLAN.maxMembers})</p>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.role === 'owner'
                        ? <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                        : <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.name || m.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.role === 'owner' ? 'Titular' : m.status === 'active' ? 'Activo' : 'Invitado'}
                          {m.email && m.name ? ` · ${m.email}` : ''}
                        </p>
                      </div>
                    </div>
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Quitar miembro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Invitar */}
            {free > 0 ? (
              <div className="pt-1 space-y-2">
                <p className="text-xs font-medium">Invitar miembro ({free} {free === 1 ? 'cupo' : 'cupos'})</p>
                <Input
                  placeholder="Nombre (opcional)"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="correo@ejemplo.com"
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button className="w-full" size="sm" variant="outline" onClick={handleInvite} disabled={sending}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {sending ? 'Enviando…' : 'Enviar invitación'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">Tu plan está completo (5/5).</p>
            )}
          </>
        )}

        {msg && <p className="text-xs text-primary">{msg}</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    </div>
  )
}
