/*
  Página WEB de pago del Plan Familiar — /plan-familiar/pago
  Es la "ventana de método de pago" en formato web. Funciona dentro de la
  misma app (la sesión de Supabase se comparte) y también abierta directo
  en un navegador.

  Flujo:
   1) Muestra el resumen del plan y los 5 cupos de la familia.
   2) "Pagar" -> /api/family/checkout (create-session):
        - Si hay Mercado Pago / Stripe configurado -> redirige a su checkout.
        - Si no hay pasarela -> abre el formulario DEMO (para la presentación).
   3) Al volver del proveedor (?status=success) confirma que el plan quedó activo.

  Estilos autocontenidos (prefijo .pf-) para no depender del tema de la app.
*/

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FAMILY_PLAN, formatAmount } from '@/lib/plan-config'
import { ensureOwnedGroup, getOwnedGroup, listMembers, type FamilyMember } from '@/lib/family'

type View = 'loading' | 'auth' | 'checkout' | 'success'

export default function PagoPlanFamiliarPage() {
  const [view, setView] = useState<View>('loading')
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [demoOpen, setDemoOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)

  // Campos del formulario demo
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' })

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get('status')
      const demoParam = params.get('demo')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setView('auth'); return }

      const group = await ensureOwnedGroup()
      if (group) setMembers(await listMembers(group.id))

      // ¿Regresó del proveedor? Verificar si ya quedó activo.
      if (statusParam === 'success') {
        let active = group?.status === 'active'
        for (let i = 0; i < 5 && !active; i++) {
          await new Promise(r => setTimeout(r, 1500))
          const g = await getOwnedGroup()
          active = g?.status === 'active'
          if (active) setPeriodEnd(g?.current_period_end ?? null)
        }
        if (active) { setView('success'); return }
      }
      if (group?.status === 'active') {
        setPeriodEnd(group.current_period_end)
        setView('success'); return
      }

      if (demoParam === '1') setDemoOpen(true)
      setView('checkout')
    }
    init().catch(() => { setError('No se pudo cargar el plan'); setView('checkout') })
  }, [])

  const usedSlots = members.length
  const freeSlots = Math.max(0, FAMILY_PLAN.maxMembers - usedSlots)

  const payWithProvider = async () => {
    setProcessing(true); setError(null)
    try {
      const res = await fetch('/api/family/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-session' }),
      })
      const data = await res.json()
      if (data.provider === 'demo') {
        setDemoOpen(true)
        setProcessing(false)
        return
      }
      if (data.url) { window.location.href = data.url; return }
      setError(data.error ?? 'No se pudo iniciar el pago')
    } catch {
      setError('Error de conexión')
    }
    setProcessing(false)
  }

  const payDemo = async () => {
    if (!card.name || card.number.replace(/\s/g, '').length < 12 || !card.exp || card.cvc.length < 3) {
      setError('Completa los datos de la tarjeta'); return
    }
    setProcessing(true); setError(null)
    try {
      const res = await fetch('/api/family/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })
      const data = await res.json()
      if (data.success) {
        setPeriodEnd(data.period_end ?? null)
        setView('success')
      } else {
        setError(data.error ?? 'No se pudo procesar el pago')
      }
    } catch {
      setError('Error de conexión')
    }
    setProcessing(false)
  }

  return (
    <div className="pf-root">
      <style>{CSS}</style>

      <header className="pf-top">
        <div className="pf-brand">
          <span className="pf-shield" aria-hidden>🛡️</span>
          <span className="pf-brand-name">SOSecure</span>
        </div>
        <span className="pf-secure">🔒 Pago cifrado</span>
      </header>

      {view === 'loading' && (
        <main className="pf-main"><div className="pf-spinner" /></main>
      )}

      {view === 'auth' && (
        <main className="pf-main pf-center">
          <div className="pf-card pf-narrow">
            <h1 className="pf-h1">Inicia sesión para continuar</h1>
            <p className="pf-sub">Necesitas tu cuenta de SOSecure para contratar el plan familiar.</p>
            <a className="pf-btn pf-btn-primary" href="/auth/login/">Iniciar sesión</a>
            <a className="pf-btn pf-btn-ghost" href="/auth/sign-up/">Crear cuenta</a>
          </div>
        </main>
      )}

      {view === 'checkout' && (
        <main className="pf-main pf-grid">
          {/* Resumen del plan */}
          <section className="pf-card">
            <span className="pf-eyebrow">Suscripción anual</span>
            <h1 className="pf-h1">{FAMILY_PLAN.name}</h1>
            <p className="pf-tagline">{FAMILY_PLAN.tagline}</p>

            <div className="pf-price">
              <span className="pf-amount">{formatAmount(FAMILY_PLAN.amountCents)}</span>
              <span className="pf-per">/ {FAMILY_PLAN.period}</span>
            </div>

            <ul className="pf-benefits">
              {FAMILY_PLAN.benefits.map((b, i) => (
                <li key={i}><span className="pf-check">✓</span>{b}</li>
              ))}
            </ul>

            {/* Firma visual: los 5 cupos de la familia */}
            <div className="pf-slots-label">Tu familia protegida ({usedSlots}/{FAMILY_PLAN.maxMembers})</div>
            <div className="pf-slots">
              {Array.from({ length: FAMILY_PLAN.maxMembers }).map((_, i) => {
                const m = members[i]
                return (
                  <div key={i} className={`pf-slot ${m ? 'pf-slot-filled' : ''}`}>
                    {m
                      ? <span className="pf-slot-initial">{(m.name || m.email || '?').charAt(0).toUpperCase()}</span>
                      : <span className="pf-slot-plus">+</span>}
                    <span className="pf-slot-tag">
                      {m ? (m.role === 'owner' ? 'Titular' : (m.name || 'Miembro')) : 'Cupo libre'}
                    </span>
                  </div>
                )
              })}
            </div>
            {freeSlots > 0 && (
              <p className="pf-hint">Podrás invitar a {freeSlots} {freeSlots === 1 ? 'persona más' : 'personas más'} desde Ajustes.</p>
            )}
          </section>

          {/* Método de pago */}
          <section className="pf-card">
            <h2 className="pf-h2">Método de pago</h2>

            {!demoOpen && (
              <>
                <button className="pf-btn pf-btn-primary" onClick={payWithProvider} disabled={processing}>
                  {processing ? 'Redirigiendo…' : `Pagar ${formatAmount(FAMILY_PLAN.amountCents)}`}
                </button>
                <p className="pf-methods">Tarjeta · OXXO · SPEI · transferencia</p>
                <p className="pf-redirect-note">
                  Te llevaremos a una página segura para completar el pago y
                  regresarás aquí automáticamente.
                </p>
                <button className="pf-link" onClick={() => setDemoOpen(true)}>
                  Usar formulario de demostración
                </button>
              </>
            )}

            {demoOpen && (
              <div className="pf-form">
                <div className="pf-demo-flag">Modo demostración — no se realiza ningún cargo real</div>
                <label className="pf-label">Nombre en la tarjeta</label>
                <input className="pf-input" value={card.name}
                  onChange={e => setCard({ ...card, name: e.target.value })}
                  placeholder="Como aparece en la tarjeta" />

                <label className="pf-label">Número de tarjeta</label>
                <input className="pf-input" value={card.number} inputMode="numeric"
                  onChange={e => setCard({ ...card, number: formatCard(e.target.value) })}
                  placeholder="4242 4242 4242 4242" maxLength={19} />

                <div className="pf-row">
                  <div className="pf-col">
                    <label className="pf-label">Vencimiento</label>
                    <input className="pf-input" value={card.exp} inputMode="numeric"
                      onChange={e => setCard({ ...card, exp: formatExp(e.target.value) })}
                      placeholder="MM/AA" maxLength={5} />
                  </div>
                  <div className="pf-col">
                    <label className="pf-label">CVC</label>
                    <input className="pf-input" value={card.cvc} inputMode="numeric"
                      onChange={e => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="123" maxLength={4} />
                  </div>
                </div>

                <button className="pf-btn pf-btn-primary" onClick={payDemo} disabled={processing}>
                  {processing ? 'Procesando…' : `Pagar ${formatAmount(FAMILY_PLAN.amountCents)}`}
                </button>
                <button className="pf-link" onClick={() => setDemoOpen(false)}>Volver</button>
              </div>
            )}

            {error && <p className="pf-error">{error}</p>}
            <p className="pf-trust">🔒 Tus datos viajan cifrados. SOSecure no almacena tu tarjeta.</p>
          </section>
        </main>
      )}

      {view === 'success' && (
        <main className="pf-main pf-center">
          <div className="pf-card pf-narrow pf-success">
            <div className="pf-success-icon">✓</div>
            <h1 className="pf-h1">¡Plan familiar activado!</h1>
            <p className="pf-sub">
              Ya puedes proteger hasta {FAMILY_PLAN.maxMembers} personas.
              {periodEnd && <> Tu plan es válido hasta el <strong>{formatDate(periodEnd)}</strong>.</>}
            </p>
            <p className="pf-sub">Invita a tu familia desde <strong>Ajustes → Plan Familiar</strong>.</p>
            <a className="pf-btn pf-btn-primary" href="/">Volver a SOSecure</a>
          </div>
        </main>
      )}
    </div>
  )
}

function formatCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExp(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CSS = `
.pf-root{min-height:100vh;background:radial-gradient(1200px 600px at 80% -10%,#0b3b37 0%,#071513 45%,#05100f 100%);color:#e6f2f0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
.pf-top{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;max-width:1040px;margin:0 auto;}
.pf-brand{display:flex;align-items:center;gap:9px;}
.pf-shield{font-size:22px;}
.pf-brand-name{font-weight:800;font-size:19px;letter-spacing:-.01em;}
.pf-secure{font-size:13px;color:#5eead4;background:rgba(45,212,191,.1);padding:5px 11px;border-radius:999px;}
.pf-main{max-width:1040px;margin:0 auto;padding:14px 22px 60px;}
.pf-center{display:flex;justify-content:center;align-items:flex-start;padding-top:48px;}
.pf-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:20px;align-items:start;}
@media(max-width:820px){.pf-grid{grid-template-columns:1fr;}}
.pf-card{background:rgba(255,255,255,.04);border:1px solid rgba(94,234,212,.16);border-radius:18px;padding:26px;backdrop-filter:blur(8px);}
.pf-narrow{max-width:420px;width:100%;text-align:center;}
.pf-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#5eead4;font-weight:700;}
.pf-h1{font-size:27px;font-weight:800;margin:8px 0 4px;letter-spacing:-.02em;line-height:1.15;}
.pf-h2{font-size:18px;font-weight:700;margin:0 0 16px;}
.pf-tagline{color:#9fc6c0;font-size:14px;margin:0 0 18px;}
.pf-price{display:flex;align-items:baseline;gap:8px;margin:0 0 20px;}
.pf-amount{font-size:42px;font-weight:800;color:#fff;letter-spacing:-.03em;}
.pf-per{color:#9fc6c0;font-size:15px;}
.pf-benefits{list-style:none;padding:0;margin:0 0 22px;display:grid;gap:11px;}
.pf-benefits li{display:flex;gap:10px;font-size:14.5px;line-height:1.45;color:#d3eae6;}
.pf-check{color:#0b1110;background:#2dd4bf;min-width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;margin-top:1px;}
.pf-slots-label{font-size:12.5px;color:#9fc6c0;font-weight:600;margin-bottom:10px;}
.pf-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.pf-slot{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border-radius:12px;border:1px dashed rgba(159,198,192,.3);}
.pf-slot-filled{border-style:solid;border-color:rgba(45,212,191,.5);background:rgba(45,212,191,.08);}
.pf-slot-initial{width:34px;height:34px;border-radius:50%;background:#2dd4bf;color:#06201c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;}
.pf-slot-plus{width:34px;height:34px;border-radius:50%;border:1px dashed rgba(159,198,192,.5);display:flex;align-items:center;justify-content:center;font-size:18px;color:#9fc6c0;}
.pf-slot-tag{font-size:10px;color:#9fc6c0;text-align:center;line-height:1.1;}
.pf-hint{font-size:12.5px;color:#9fc6c0;margin:14px 0 0;}
.pf-btn{display:block;width:100%;text-align:center;padding:14px 18px;border-radius:12px;font-size:15.5px;font-weight:700;cursor:pointer;border:none;text-decoration:none;margin-top:6px;transition:transform .06s,opacity .2s;}
.pf-btn:active{transform:scale(.99);}
.pf-btn:disabled{opacity:.6;cursor:default;}
.pf-btn-primary{background:linear-gradient(180deg,#2dd4bf,#14b8a6);color:#06201c;}
.pf-btn-ghost{background:transparent;border:1px solid rgba(159,198,192,.35);color:#d3eae6;margin-top:10px;}
.pf-methods{text-align:center;font-size:13px;color:#9fc6c0;margin:12px 0 4px;}
.pf-redirect-note{font-size:12.5px;color:#82aaa4;text-align:center;line-height:1.5;margin:6px 0 14px;}
.pf-link{background:none;border:none;color:#5eead4;font-size:13.5px;cursor:pointer;text-decoration:underline;display:block;margin:4px auto 0;}
.pf-form{display:flex;flex-direction:column;}
.pf-demo-flag{background:rgba(250,204,21,.12);border:1px solid rgba(250,204,21,.4);color:#fde68a;font-size:12.5px;padding:9px 12px;border-radius:10px;margin-bottom:16px;text-align:center;}
.pf-label{font-size:12.5px;color:#9fc6c0;margin:12px 0 5px;font-weight:600;}
.pf-input{background:rgba(0,0,0,.25);border:1px solid rgba(159,198,192,.25);border-radius:10px;padding:12px 13px;color:#fff;font-size:15px;outline:none;width:100%;box-sizing:border-box;}
.pf-input:focus{border-color:#2dd4bf;}
.pf-input::placeholder{color:#5c7d78;}
.pf-row{display:flex;gap:12px;}
.pf-col{flex:1;}
.pf-error{color:#fca5a5;font-size:13.5px;margin:12px 0 0;text-align:center;}
.pf-trust{font-size:12px;color:#7da39d;text-align:center;margin:16px 0 0;}
.pf-sub{color:#bcdbd6;font-size:15px;line-height:1.55;margin:6px 0 18px;}
.pf-success-icon{width:64px;height:64px;border-radius:50%;background:#2dd4bf;color:#06201c;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
.pf-spinner{width:34px;height:34px;border:3px solid rgba(94,234,212,.25);border-top-color:#2dd4bf;border-radius:50%;animation:pf-spin .8s linear infinite;margin:60px auto;}
@keyframes pf-spin{to{transform:rotate(360deg);}}
`
