/*
  Página WEB de pago del Plan Premium — /plan-premium/pago
  Es la "ventana de método de pago" en formato web. Funciona dentro de la
  misma app (la sesión de Supabase se comparte) y también abierta directo
  en un navegador.

  Flujo:
   1) Muestra el resumen del plan premium y sus funciones.
   2) "Pagar" -> /api/premium/checkout (create-session):
        - Si hay Mercado Pago / Stripe configurado -> redirige a su checkout.
        - Si no hay pasarela -> abre el formulario DEMO (para la presentación).
   3) Al volver del proveedor (?status=success) confirma que quedó activo.

  Estilos autocontenidos (prefijo .pf-) para no depender del tema de la app.
*/

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PREMIUM_PLAN, formatAmount } from '@/lib/plan-config'
import { getSubscription, ensureSubscription } from '@/lib/premium'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

type View = 'loading' | 'auth' | 'checkout' | 'success'
type Provider = 'mercadopago' | 'paypal'

export default function PagoPlanPremiumPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('loading')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider>('mercadopago')

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get('status')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setView('auth'); return }

      const sub = await ensureSubscription()

      // ¿Regresó del proveedor? Verificar si ya quedó activo.
      if (statusParam === 'success') {
        // PayPal regresa con ?token=ORDER_ID
        const paypalToken = params.get('token')
        if (paypalToken) {
          const captureRes = await fetch('/api/premium/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'capture-paypal', token: paypalToken }),
          })
          const captureData = await captureRes.json()
          if (captureData.success) {
            setPeriodEnd(captureData.period_end ?? null)
            setView('success')
            return
          }
        }

        // Mercado Pago regresa con ?collection_id=PAYMENT_ID&collection_status=approved
        const mpPaymentId = params.get('collection_id') ?? params.get('payment_id')
        const mpStatus = params.get('collection_status')
        if (mpPaymentId && mpStatus === 'approved') {
          const captureRes = await fetch('/api/premium/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'capture-mercadopago', token: mpPaymentId }),
          })
          const captureData = await captureRes.json()
          if (captureData.success) {
            setPeriodEnd(captureData.period_end ?? null)
            setView('success')
            return
          }
        }

        // Fallback: esperar webhook (Stripe u otros)
        let active = sub?.status === 'active'
        for (let i = 0; i < 5 && !active; i++) {
          await new Promise(r => setTimeout(r, 1500))
          const s = await getSubscription()
          active = s?.status === 'active'
          if (active) setPeriodEnd(s?.current_period_end ?? null)
        }
        if (active) { setView('success'); return }
      }
      if (sub?.status === 'active') {
        setPeriodEnd(sub.current_period_end)
        setView('success'); return
      }

      setView('checkout')
    }
    init().catch(() => { setError(t('pay_errorLoad')); setView('checkout') })
  }, [])

  const payWithProvider = async () => {
    setProcessing(true); setError(null)
    try {
      const res = await fetch('/api/premium/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-session', provider }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      setError(data.error ?? t('pay_errorStart'))
    } catch {
      setError(t('family_connectionError'))
    }
    setProcessing(false)
  }

  return (
    <div className="pf-root">
      <style>{CSS}</style>

      <header className="pf-top">
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <a href="/" className="pf-back-btn">← Volver</a>
          <div className="pf-brand">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="pf-brand-name">SOSecure</span>
          </div>
        </div>
        <span className="pf-secure">{t('pay_encrypted')}</span>
      </header>

      {view === 'loading' && (
        <main className="pf-main"><div className="pf-spinner" /></main>
      )}

      {view === 'auth' && (
        <main className="pf-main pf-center">
          <div className="pf-card pf-narrow">
            <h1 className="pf-h1">{t('pay_signInTitle')}</h1>
            <p className="pf-sub">{t('pay_signInDescPremium')}</p>
            <a className="pf-btn pf-btn-primary" href="/auth/login/">{t('pay_signIn')}</a>
            <a className="pf-btn pf-btn-ghost" href="/auth/sign-up/">{t('pay_createAccount')}</a>
          </div>
        </main>
      )}

      {view === 'checkout' && (
        <main className="pf-main pf-grid">
          {/* Resumen del plan */}
          <section className="pf-card">
            <span className="pf-eyebrow">{t('plan_premiumEyebrow')}</span>
            <h1 className="pf-h1">{t('plan_premiumNameLabel')}</h1>
            <p className="pf-tagline">{t('plan_premiumTagline')}</p>

            <div className="pf-price">
              <span className="pf-amount">{formatAmount(PREMIUM_PLAN.amountCents)}</span>
              <span className="pf-per">/ {t('plan_premiumPeriod')}</span>
            </div>

            <ul className="pf-benefits">
              {([1,2,3,4] as const).map(n => (
                <li key={n}><span className="pf-check">✓</span>{t(`plan_premiumBenefit${n}`)}</li>
              ))}
            </ul>

            <div className="pf-badge-row">
              <span className="pf-badge">{t('plan_premiumBadge1')}</span>
              <span className="pf-badge">{t('plan_premiumBadge2')}</span>
              <span className="pf-badge">{t('plan_premiumBadge3')}</span>
            </div>
          </section>

          {/* Método de pago */}
          <section className="pf-card">
            <h2 className="pf-h2">{t('pay_payMethod')}</h2>

            {/* Selector de proveedor */}
            <div className="pf-provider-grid">
              <button
                className={`pf-provider-btn ${provider === 'mercadopago' ? 'pf-provider-active' : ''}`}
                onClick={() => setProvider('mercadopago')}
              >
                <span className="pf-provider-logo">
                  <svg width="22" height="22" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#009EE3"/><path d="M8 17.6c0-4.2 3.6-7.6 8-7.6s8 3.4 8 7.6c0 .4-.3.7-.7.7H8.7c-.4 0-.7-.3-.7-.7z" fill="#fff"/></svg>
                </span>
                <span>Mercado Pago</span>
                {provider === 'mercadopago' && <span className="pf-provider-check">✓</span>}
              </button>
              <button
                className={`pf-provider-btn ${provider === 'paypal' ? 'pf-provider-active' : ''}`}
                onClick={() => setProvider('paypal')}
              >
                <span className="pf-provider-logo">
                  <svg width="22" height="22" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#003087"/><path d="M20.5 10.5c.7 2.5-.6 5.3-3.6 6H14l-1 5.5H10l2.5-13.5h5.5c1.5 0 2.3.9 2.5 2z" fill="#009CDE"/><path d="M22.5 13c.5 2-.5 4.5-3 5.5H17l-.8 4.5H14l2.3-12h4.7c1.2 0 1.8.7 1.5 2z" fill="#fff"/></svg>
                </span>
                <span>PayPal</span>
                {provider === 'paypal' && <span className="pf-provider-check">✓</span>}
              </button>
            </div>

            {provider === 'mercadopago' && (
              <p className="pf-provider-note">Tarjeta, OXXO, SPEI y más</p>
            )}
            {provider === 'paypal' && (
              <p className="pf-provider-note">Tarjeta o saldo PayPal</p>
            )}

            <button className="pf-btn pf-btn-primary" onClick={payWithProvider} disabled={processing} style={{marginTop:'14px'}}>
              {processing ? t('pay_redirecting') : t('pay_pay').replace('{amount}', formatAmount(PREMIUM_PLAN.amountCents))}
            </button>
            <p className="pf-redirect-note">{t('pay_redirectNote')}</p>
            {error && <p className="pf-error">{error}</p>}
            <p className="pf-trust">{t('pay_trust')}</p>
          </section>
        </main>
      )}

      {view === 'success' && (
        <main className="pf-main pf-center">
          <div className="pf-card pf-narrow pf-success">
            <div className="pf-success-icon">✓</div>
            <h1 className="pf-h1">{t('plan_premiumActivated')}</h1>
            <p className="pf-sub">
              {t('plan_premiumSuccess').replace('{n}', String(PREMIUM_PLAN.features.maxContacts))}
              {periodEnd && <> {t('pay_validUntil').replace('{date}', formatDate(periodEnd))}</>}
            </p>
            <a className="pf-btn pf-btn-primary" href="/">{t('pay_returnToApp')}</a>
          </div>
        </main>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CSS = `
.pf-root{min-height:100vh;background:radial-gradient(1200px 600px at 80% -10%,#0b3b37 0%,#071513 45%,#05100f 100%);color:#e6f2f0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
.pf-top{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;max-width:1040px;margin:0 auto;}
.pf-back-btn{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#5eead4;background:rgba(45,212,191,.1);border:1px solid rgba(94,234,212,.25);padding:7px 14px;border-radius:999px;text-decoration:none;transition:background .15s;}
.pf-back-btn:hover{background:rgba(45,212,191,.2);}
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
.pf-badge-row{display:flex;flex-wrap:wrap;gap:8px;}
.pf-badge{font-size:12px;font-weight:600;color:#5eead4;background:rgba(45,212,191,.1);border:1px solid rgba(94,234,212,.25);padding:6px 11px;border-radius:999px;}
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
.pf-provider-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;}
.pf-provider-btn{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;border:1.5px solid rgba(159,198,192,.25);background:rgba(0,0,0,.2);color:#d3eae6;font-size:14px;font-weight:600;cursor:pointer;position:relative;transition:border-color .15s,background .15s;}
.pf-provider-btn:hover{border-color:rgba(45,212,191,.4);background:rgba(45,212,191,.06);}
.pf-provider-active{border-color:#2dd4bf !important;background:rgba(45,212,191,.1) !important;}
.pf-provider-logo{display:flex;align-items:center;}
.pf-provider-check{margin-left:auto;color:#2dd4bf;font-weight:900;font-size:13px;}
.pf-provider-note{font-size:12px;color:#82aaa4;text-align:center;margin:4px 0 0;}
`
