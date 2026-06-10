/*
  Página para aceptar una invitación al Plan Familiar — /plan-familiar/aceptar?token=...
  - Si el usuario tiene sesión: vincula su cuenta al grupo (POST /api/family/accept).
  - Si no tiene sesión: guarda el token y lo manda a iniciar sesión.
    Al volver a la app, app-shell auto-completa la invitación pendiente.
*/

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type State = 'loading' | 'joined' | 'need_auth' | 'error'

export default function AceptarInvitacionPage() {
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [groupName, setGroupName] = useState('Plan Familiar')

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) { setState('error'); setMessage('Enlace de invitación inválido.'); return }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Guardar para completar tras iniciar sesión
        localStorage.setItem('sosecure-pending-invite', token)
        setState('need_auth')
        return
      }

      const res = await fetch('/api/family/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.success) {
        setGroupName(data.group_name ?? 'Plan Familiar')
        setState('joined')
      } else {
        setState('error')
        setMessage(data.error ?? 'No se pudo aceptar la invitación.')
      }
    }
    run().catch(() => { setState('error'); setMessage('Ocurrió un error.') })
  }, [])

  return (
    <div className="pf-root">
      <style>{CSS}</style>
      <header className="pf-top">
        <div className="pf-brand"><span>🛡️</span><span className="pf-brand-name">SOSecure</span></div>
      </header>
      <main className="pf-main">
        <div className="pf-card">
          {state === 'loading' && <div className="pf-spinner" />}

          {state === 'joined' && (
            <>
              <div className="pf-icon pf-ok">✓</div>
              <h1 className="pf-h1">¡Bienvenido a {groupName}!</h1>
              <p className="pf-sub">Ya formas parte del plan familiar. Tienes acceso completo a SOSecure sin costo.</p>
              <a className="pf-btn" href="/">Abrir SOSecure</a>
            </>
          )}

          {state === 'need_auth' && (
            <>
              <div className="pf-icon">👋</div>
              <h1 className="pf-h1">Te invitaron a un plan familiar</h1>
              <p className="pf-sub">Inicia sesión o crea tu cuenta para unirte. Completaremos tu invitación automáticamente.</p>
              <a className="pf-btn" href="/auth/login/">Iniciar sesión</a>
              <a className="pf-btn pf-ghost" href="/auth/sign-up/">Crear cuenta</a>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="pf-icon pf-err">!</div>
              <h1 className="pf-h1">No se pudo unir</h1>
              <p className="pf-sub">{message}</p>
              <a className="pf-btn" href="/">Ir a SOSecure</a>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

const CSS = `
.pf-root{min-height:100vh;background:radial-gradient(1200px 600px at 80% -10%,#0b3b37 0%,#071513 45%,#05100f 100%);color:#e6f2f0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
.pf-top{display:flex;align-items:center;padding:18px 22px;max-width:520px;margin:0 auto;}
.pf-brand{display:flex;align-items:center;gap:9px;font-size:20px;}
.pf-brand-name{font-weight:800;letter-spacing:-.01em;}
.pf-main{max-width:520px;margin:0 auto;padding:24px 22px;display:flex;justify-content:center;}
.pf-card{background:rgba(255,255,255,.04);border:1px solid rgba(94,234,212,.16);border-radius:18px;padding:34px 26px;text-align:center;width:100%;}
.pf-icon{width:64px;height:64px;border-radius:50%;background:rgba(45,212,191,.14);font-size:30px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
.pf-ok{background:#2dd4bf;color:#06201c;font-weight:900;}
.pf-err{background:rgba(248,113,113,.18);color:#fca5a5;font-weight:900;}
.pf-h1{font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-.02em;}
.pf-sub{color:#bcdbd6;font-size:15px;line-height:1.55;margin:0 0 22px;}
.pf-btn{display:block;width:100%;box-sizing:border-box;padding:14px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;background:linear-gradient(180deg,#2dd4bf,#14b8a6);color:#06201c;margin-top:8px;}
.pf-ghost{background:transparent;border:1px solid rgba(159,198,192,.35);color:#d3eae6;}
.pf-spinner{width:34px;height:34px;border:3px solid rgba(94,234,212,.25);border-top-color:#2dd4bf;border-radius:50%;animation:pf-spin .8s linear infinite;margin:24px auto;}
@keyframes pf-spin{to{transform:rotate(360deg);}}
`
