/*
  AppShell es el componente raíz que envuelve toda la aplicación. Se encarga de:
- Gestionar el estado global de la aplicación (ubicación, incidentes cercanos, tema, usuario)
- Manejar la geolocalización y sincronización de datos con Supabase
- Renderizar la estructura principal de la UI (header, main, navegación)
- Proporcionar un contexto para los permisos necesarios para el funcionamiento de la app 
  (geolocalización, notificaciones, etc.)
*/

'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
import { PermissionGate } from './permission-gate'
import { checkIncidentReminders } from '@/lib/incident-reminder'
import { sendAlarmNotification } from '@/lib/notifications'
import { BottomNavigation } from './bottom-navigation'
import { SOSButton } from './sos-button'
import { EmergencyChat } from './emergency-chat'
import { HomeTab } from './tabs/home-tab'
import { MedicTab } from './tabs/medic-tab'
import { BeforeTab } from './tabs/before-tab'
import { DuringTab } from './tabs/during-tab'
import { AfterTab } from './tabs/after-tab'
import { Shield, Settings, LogOut, BellRing, WifiOff, Sun, Moon, UserCircle, Trash2, Lock, LockOpen, KeyRound, CheckCircle2, Delete, ShieldCheck, Volume2, Puzzle, Languages } from 'lucide-react'
import { useTranslation, LANG_LABELS, type Lang, SPEECH_RECOGNITION_LANG, effectiveVoiceKeyword } from '@/lib/i18n'
import { matchesVoiceKeyword } from '@/lib/voice-match'
import { PinLock } from './pin-lock'
import { Button } from '@/components/ui/button'
import { FamilyPlanSection } from './family-plan-section'
import { PremiumPlanSection } from './premium-plan-section'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { User } from '@supabase/supabase-js'

export function AppShell() {
  const { activeTab, setCurrentLocation, setLocationStatus, setNearbyIncidents, offlineQueue, isLiveSharing, voiceKeyword, sosActive, volumePresses, setVolumePresses, volumeWindow, setVolumeWindow, simpleMode, setSimpleMode, language, setLanguage } = useAppStore()
  const { t } = useTranslation()
  const { coordinates, loading: locationLoading, error: locationError } = useGeolocation({ watch: true })
  const [user, setUser] = useState<User | null>(null)
  const liveBroadcastRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceRecognitionRef = useRef<any>(null)
  const sosActiveRef = useRef(sosActive)
  const voicePausedRef = useRef(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isDark, setIsDark] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // PIN state
  // pinCheckLoading arranca en true (fail-closed): no se muestra ni el contenido
  // principal ni el PIN lock hasta saber con certeza si hay que bloquear. Evita
  // el "flash" donde el contenido sensible se monta antes de que resuelva el
  // fetch de /api/pin.
  const [pinCheckLoading, setPinCheckLoading] = useState(true)
  const [pinLocked, setPinLocked] = useState(false)
  const [pinProfile, setPinProfile] = useState<{
    pin_enabled: boolean
    pin_configured: boolean
    pin_timeout_minutes: number
  }>({ pin_enabled: false, pin_configured: false, pin_timeout_minutes: 5 })
  const [forgotPinSent, setForgotPinSent] = useState(false)
  const [forgotPinLoading, setForgotPinLoading] = useState(false)

  // PIN setup wizard state (inside settings)
  type PinStep = 'idle' | 'enter-new' | 'confirm-new' | 'done'
  const [pinStep, setPinStep] = useState<PinStep>('idle')
  const [pinNewDigits, setPinNewDigits] = useState<string[]>([])
  const [pinConfirmDigits, setPinConfirmDigits] = useState<string[]>([])
  const [pinMismatch, setPinMismatch] = useState(false)
  const [pinSaving, setPinSaving] = useState(false)

  const applyTheme = (theme: string) => {
    const isDarkTheme = theme === 'dark'
    const bg = isDarkTheme ? 'oklch(0.13 0.01 260)' : 'oklch(0.98 0.005 260)'
    const fg = isDarkTheme ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)'
    const card = isDarkTheme ? 'oklch(0.17 0.01 260)' : 'oklch(1 0 0)'
    const border = isDarkTheme ? 'oklch(0.28 0.02 260)' : 'oklch(0.90 0.01 260)'
    const muted = isDarkTheme ? 'oklch(0.22 0.02 260)' : 'oklch(0.95 0.01 260)'
    const primary = isDarkTheme ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)'

    // Helper: skip elements inside Radix portals (dropdowns, selects, dialogs)
    const inPortal = (el: HTMLElement) => !!el.closest('[data-radix-popper-content-wrapper],[data-radix-portal]')

    document.body.style.backgroundColor = bg
    document.body.style.color = fg

    document.querySelectorAll<HTMLElement>('.bg-background, .min-h-screen, header, nav').forEach(el => {
      if (inPortal(el)) return
      el.style.backgroundColor = bg
      el.style.color = fg
    })

    document.querySelectorAll<HTMLElement>('.text-muted-foreground').forEach(el => {
      if (inPortal(el)) return
      el.style.color = isDarkTheme ? 'oklch(0.65 0.02 260)' : 'oklch(0.45 0.02 260)'
    })

    const hasBgClass = (el: HTMLElement, word: string) =>
      Array.from(el.classList).some(c => c.startsWith(`bg-${word}`))

    document.querySelectorAll<HTMLElement>('.bg-card, [class*="card"]').forEach(el => {
      if (el.tagName === 'BUTTON') return
      if (inPortal(el)) return
      if (!hasBgClass(el, 'card')) return
      if (el.classList.contains('leaflet-container') || el.closest('.leaflet-container')) return
      el.style.backgroundColor = card
      el.style.color = fg
      el.style.borderColor = border
    })

    document.querySelectorAll<HTMLElement>('.bg-muted, [class*="muted"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.closest('nav')) return
      if (inPortal(el)) return
      if (!hasBgClass(el, 'muted')) return
      el.style.backgroundColor = muted
    })

    document.querySelectorAll<HTMLElement>('nav button').forEach(el => {
      el.style.backgroundColor = 'transparent'
    })

    // Limpiar estilos inline de botones del nav y dejar que React maneje sus colores
    document.querySelectorAll<HTMLElement>('nav button').forEach(el => {
      el.style.backgroundColor = 'transparent'
      el.style.color = ''
    })
  }

  useEffect(() => {
    const saved = localStorage.getItem('sosecure-theme') || 'dark'
    setIsDark(saved === 'dark')
    applyTheme(saved)
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.className = next
    localStorage.setItem('sosecure-theme', next)
    applyTheme(next)
    setIsDark(!isDark)
  }

  useEffect(() => {
    if (coordinates) {
      setCurrentLocation(coordinates)
    } else {
      setLocationStatus(locationLoading, locationError)
    }
  }, [coordinates, locationLoading, locationError, setCurrentLocation, setLocationStatus])

  useEffect(() => {
    const saved = localStorage.getItem('sosecure-theme') || 'dark'
    setTimeout(() => applyTheme(saved), 50)
  }, [activeTab])

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    checkIncidentReminders((title, body) => sendAlarmNotification(title, body))
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    const loadIncidents = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('is_active', true)
        .order('reported_at', { ascending: false })
        .limit(100)
      if (data) setNearbyIncidents(data)
    }

    loadIncidents()

    const channel = supabase
      .channel('incidents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        loadIncidents()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [setNearbyIncidents])

  // Broadcasting de ubicación en vivo — persiste en todas las pestañas
  useEffect(() => {
    if (!user || !isLiveSharing) {
      if (liveBroadcastRef.current) { clearInterval(liveBroadcastRef.current); liveBroadcastRef.current = null }
      return
    }

    const broadcast = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const supabase = createClient()
        await supabase.from('user_locations').upsert({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email || 'Usuario',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          updated_at: new Date().toISOString(),
          is_sharing: true,
        }, { onConflict: 'user_id' })
      }, undefined, { enableHighAccuracy: true, timeout: 10000 })
    }

    broadcast()
    liveBroadcastRef.current = setInterval(broadcast, 30_000)
    return () => { if (liveBroadcastRef.current) { clearInterval(liveBroadcastRef.current); liveBroadcastRef.current = null } }
  }, [user, isLiveSharing])

  // Sincronizar sosActiveRef y pausar/reanudar el reconocimiento de voz síncronamente
  // para evitar la condición de carrera donde onend se dispara antes de que React actualice la ref.
  useEffect(() => {
    sosActiveRef.current = sosActive
    if (sosActive) {
      voicePausedRef.current = true
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.stop() } catch { /* ignore */ }
      }
    } else {
      voicePausedRef.current = false
      if (voiceRecognitionRef.current) {
        try { voiceRecognitionRef.current.start() } catch { /* ignore */ }
      }
    }
  }, [sosActive])

  // Reconocimiento de voz global — activo en todas las pestañas mientras haya palabra clave configurada.
  // Se recrea cuando cambia la palabra clave O el idioma elegido en la app; sosActive se lee desde la ref
  // para evitar closures stale.
  //
  // Antes `recognition.lang` se armaba como
  // `navigator.language.startsWith('es') ? navigator.language : 'es'` — es decir, SIEMPRE terminaba en
  // español (el idioma del navegador si empezaba con "es", si no "es" a secas). No existía ninguna rama
  // que terminara en inglés, sin importar qué idioma tuviera el navegador NI qué idioma hubiera elegido
  // la persona dentro de la app. Con la app en inglés, el motor de reconocimiento seguía escuchando en
  // español, así que ninguna palabra en inglés coincidía jamás. Ahora usa el idioma que la persona eligió
  // en SOSecure (`language`, no `navigator.language`), vía SPEECH_RECOGNITION_LANG.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return

    if (voiceRecognitionRef.current) {
      try { voiceRecognitionRef.current.stop() } catch { /* ignore */ }
      voiceRecognitionRef.current = null
    }

    if (!voiceKeyword) return

    // Si voiceKeyword sigue en el default de fábrica ("socorro") y la app está
    // en un idioma que tiene su propia palabra por defecto, se escucha esa en
    // vez de forzar a la persona a decir una palabra en español que nunca
    // configuró a propósito. No toca lo que alguien sí haya guardado a mano.
    const keyword = effectiveVoiceKeyword(voiceKeyword, language)

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.lang = SPEECH_RECOGNITION_LANG[language] ?? 'es-MX'
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      if (sosActiveRef.current) return
      const transcript = event.results[event.results.length - 1][0].transcript
      // Antes era `transcript.includes(voiceKeyword)`: una palabra clave corta
      // ("ya") disparaba un SOS real con solo decir "playa", y un acento en la
      // transcripción ("ayúdame") nunca coincidía con la palabra guardada sin
      // tilde ("ayudame"). matchesVoiceKeyword exige palabra completa y
      // normaliza acentos en los dos lados antes de comparar.
      if (matchesVoiceKeyword(transcript, keyword)) {
        window.dispatchEvent(new Event('sosecure:activate'))
      }
    }

    recognition.onerror = (event: any) => {
      // No reiniciar en errores de permiso o de no-speech para evitar bucles
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        voiceRecognitionRef.current = null
      }
    }

    recognition.onend = () => {
      // Usar voicePausedRef (actualizada síncronamente) para evitar reinicios durante el SOS
      if (voiceRecognitionRef.current === recognition && !voicePausedRef.current) {
        try { recognition.start() } catch { /* ignore */ }
      }
    }

    try {
      recognition.start()
      voiceRecognitionRef.current = recognition
    } catch { /* ignore */ }

    return () => {
      // Marcar primero la ref como null para que onend no reintente tras el cleanup
      voiceRecognitionRef.current = null
      try { recognition.stop() } catch { /* ignore */ }
    }
  }, [voiceKeyword, language])

  // Auto-aceptar invitación de plan familiar pendiente tras iniciar sesión
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('sosecure-pending-invite')
    if (!token) return
    fetch('/api/family/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(() => localStorage.removeItem('sosecure-pending-invite'))
      .catch(() => {})
  }, [user])

  // Load PIN profile and check if lock screen should show
  useEffect(() => {
    if (!user) return
    fetch('/api/pin')
      .then(res => res.json())
      .then((data) => {
        const profile = {
          pin_enabled: data.pin_enabled ?? false,
          pin_configured: data.pin_configured ?? false,
          pin_timeout_minutes: data.pin_timeout_minutes ?? 5,
        }
        setPinProfile(profile)

        if (!profile.pin_enabled || !profile.pin_configured) {
          setPinCheckLoading(false)
          return
        }

        const lastActive = sessionStorage.getItem('sosecure-last-active')
        if (!lastActive) {
          setPinLocked(true)
          setPinCheckLoading(false)
          return
        }
        const elapsed = (Date.now() - parseInt(lastActive)) / 60000
        if (elapsed >= profile.pin_timeout_minutes) {
          setPinLocked(true)
        }
        setPinCheckLoading(false)
      })
      .catch(() => setPinCheckLoading(false))
  }, [user])

  // Track visibility changes to enforce PIN timeout
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('sosecure-last-active', Date.now().toString())
      } else if (document.visibilityState === 'visible' && pinProfile.pin_enabled && pinProfile.pin_configured) {
        const lastActive = sessionStorage.getItem('sosecure-last-active')
        if (!lastActive) return
        const elapsed = (Date.now() - parseInt(lastActive)) / 60000
        if (elapsed >= pinProfile.pin_timeout_minutes) {
          setPinLocked(true)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [pinProfile])

  const handlePinUnlock = () => {
    sessionStorage.setItem('sosecure-last-active', Date.now().toString())
    setPinLocked(false)
  }

  const handleForgotPin = async () => {
    if (!user) return
    setForgotPinLoading(true)
    await fetch('/api/pin', { method: 'DELETE' })
    setForgotPinLoading(false)
    setForgotPinSent(true)
  }

  // PIN setup helpers (used in settings dialog)
  const pinSetupDigit = (d: string, step: 'new' | 'confirm') => {
    if (step === 'new') {
      if (pinNewDigits.length >= 4) return
      const next = [...pinNewDigits, d]
      setPinNewDigits(next)
      if (next.length === 4) setPinStep('confirm-new')
    } else {
      if (pinConfirmDigits.length >= 4) return
      const next = [...pinConfirmDigits, d]
      setPinConfirmDigits(next)
      if (next.length === 4) {
        if (next.join('') !== pinNewDigits.join('')) {
          setPinMismatch(true)
          setTimeout(() => {
            setPinConfirmDigits([])
            setPinMismatch(false)
          }, 700)
        } else {
          savePinSetup(next.join(''))
        }
      }
    }
  }

  // Permite escribir el PIN del asistente de configuración con el teclado físico,
  // igual que ya funciona en la pantalla de desbloqueo (pin-lock.tsx).
  useEffect(() => {
    if (pinStep !== 'enter-new' && pinStep !== 'confirm-new') return
    const stepKey = pinStep === 'enter-new' ? 'new' : 'confirm'
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') pinSetupDigit(e.key, stepKey)
      if (e.key === 'Backspace') {
        if (stepKey === 'new') setPinNewDigits(p => p.slice(0, -1))
        else setPinConfirmDigits(p => p.slice(0, -1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pinStep, pinNewDigits, pinConfirmDigits])

  const savePinSetup = async (pin: string) => {
    if (!user) return
    setPinSaving(true)
    // El PIN viaja en texto plano por HTTPS al servidor, que es quien lo
    // hashea con bcrypt — el cliente nunca calcula ni ve el hash.
    await fetch('/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, pin_enabled: true }),
    })
    setPinProfile(prev => ({ ...prev, pin_enabled: true, pin_configured: true }))
    // Limpiar el timestamp de "última actividad" para que la próxima carga
    // bloquee de inmediato, en vez de heredar un timestamp de antes de activar el PIN.
    sessionStorage.removeItem('sosecure-last-active')
    setPinStep('done')
    setPinSaving(false)
    setTimeout(() => {
      setPinStep('idle')
      setPinNewDigits([])
      setPinConfirmDigits([])
    }, 1500)
  }

  const togglePinEnabled = async (enabled: boolean) => {
    if (!user) return
    if (!enabled) {
      await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin_enabled: false }),
      })
      setPinProfile(prev => ({ ...prev, pin_enabled: false }))
    } else {
      // Si ya hay un PIN configurado, solo habilitar; si no, iniciar el asistente de creación.
      if (pinProfile.pin_configured) {
        await fetch('/api/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin_enabled: true }),
        })
        sessionStorage.removeItem('sosecure-last-active')
        setPinProfile(prev => ({ ...prev, pin_enabled: true }))
      } else {
        setPinStep('enter-new')
      }
    }
  }

  const changeTimeout = async (minutes: number) => {
    if (!user) return
    const res = await fetch('/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_timeout_minutes: minutes }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('No se pudo guardar pin_timeout_minutes:', body.error)
      return
    }
    setPinProfile(prev => ({ ...prev, pin_timeout_minutes: minutes }))
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  // El botón de Ajustes → Cuenta → Eliminar cuenta redirige a
  // /solicitar-eliminacion (misma página pública que exige el aviso de
  // privacidad para usuarios sin sesión) en vez de agendar el borrado
  // directo con la sesión actual — un solo flujo de confirmación por
  // correo para ambos casos, con o sin sesión iniciada.
  const handleGoToDeleteAccount = () => {
    window.location.href = `/solicitar-eliminacion?email=${encodeURIComponent(user?.email ?? '')}`
  }

  // Fail-closed: mientras no sabemos con certeza quién es el usuario ni si
  // hay que bloquear, no se monta ni el contenido principal ni el PIN lock —
  // solo una pantalla neutra. Antes esto solo se activaba cuando `user` ya
  // existía, pero `user` arranca en null (efecto de arriba aún no resuelve),
  // así que el contenido principal se colaba antes de saberlo. Evita el
  // "flash" donde datos sensibles aparecen brevemente antes del PIN.
  if (!user || pinCheckLoading) {
    return <div className="fixed inset-0 z-[var(--z-pin-lock)] bg-background" />
  }

  // Render PIN lock overlay (takes over the entire screen)
  if (pinLocked && pinProfile.pin_configured && user) {
    if (forgotPinSent) {
      return (
        <div className="fixed inset-0 z-[var(--z-pin-lock)] bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-lg font-bold">{t('settings_checkEmail')}</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('settings_resetPinSent').replace('{email}', user.email ?? '')}
          </p>
        </div>
      )
    }
    return (
      <PinLock
        userId={user.id}
        onUnlock={handlePinUnlock}
        onForgotPin={handleForgotPin}
      />
    )
  }

  return (
    <PermissionGate>
      <div className="min-h-screen bg-background ambient-bg flex flex-col">
        <header className="sticky top-0 z-[var(--z-header)] glass-nav safe-area-top">
          <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">SOSecure</span>
              {!isOnline && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/20 rounded-full">
                  <WifiOff className="w-3 h-3 text-warning" />
                  <span className="text-xs text-warning font-medium">{t('header_offline')}</span>
                </div>
              )}
              {offlineQueue.length > 0 && isOnline && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 rounded-full">
                  <BellRing className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary font-medium">{t('header_sync').replace('{n}', String(offlineQueue.length))}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <UserCircle className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[var(--z-popover)] bg-popover text-popover-foreground">
                  {user && (
                    <>
                      <DropdownMenuItem className="text-xs text-muted-foreground cursor-default select-none">
                        {user.email}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    {t('header_settings')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('header_signout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Dialog de Ajustes */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t('settings_title')}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto pr-1">
                  {/* Idioma */}
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Languages className="w-4 h-4" />
                      {t('settings_language')}
                    </p>
                    <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
                          <SelectItem key={code} value={code}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  

                  {/* Tema */}
                  <div>
                    <p className="text-sm font-medium mb-3">{t('settings_appearance')}</p>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        <span className="text-sm">{isDark ? t('settings_darkTheme') : t('settings_lightTheme')}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={toggleTheme}>
                        {isDark ? <Sun className="w-4 h-4 mr-1" /> : <Moon className="w-4 h-4 mr-1" />}
                        {isDark ? t('settings_switchToLight') : t('settings_switchToDark')}
                      </Button>
                    </div>
                    {/* Modo Simple */}
                    <div className="pt-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-primary/5">
                        <div className="flex items-center gap-2">
                          <Puzzle className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{t('settings_simpleMode')}</p>
                            <p className="text-xs text-muted-foreground">{t('settings_simpleModeDesc')}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSimpleMode(!simpleMode)}
                          style={{
                            position: 'relative',
                            width: '44px',
                            height: '24px',
                            borderRadius: '9999px',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            backgroundColor: simpleMode
                              ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                              : (isDark ? 'oklch(0.35 0.02 260)' : 'oklch(0.78 0.01 260)'),
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: '4px',
                            left: '0',
                            width: '16px',
                            height: '16px',
                            borderRadius: '9999px',
                            backgroundColor: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            transition: 'transform 0.2s',
                            transform: simpleMode ? 'translateX(24px)' : 'translateX(4px)',
                          }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* PIN de seguridad */}
                  <div>
                    <p className="text-sm font-medium mb-3">{t('settings_pin')}</p>
                    <div className="rounded-lg border border-border p-3 space-y-3">

                      {/* Toggle activar/desactivar — inline styles para evitar override del tema */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{t('settings_pinEnable')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePinEnabled(!pinProfile.pin_enabled)}
                          style={{
                            position: 'relative',
                            width: '44px',
                            height: '24px',
                            borderRadius: '9999px',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            backgroundColor: pinProfile.pin_enabled && pinProfile.pin_configured
                              ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                              : (isDark ? 'oklch(0.35 0.02 260)' : 'oklch(0.78 0.01 260)'),
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: '4px',
                            left: '0',
                            width: '16px',
                            height: '16px',
                            borderRadius: '9999px',
                            backgroundColor: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            transition: 'transform 0.2s',
                            transform: pinProfile.pin_enabled && pinProfile.pin_configured ? 'translateX(24px)' : 'translateX(4px)',
                          }} />
                        </button>
                      </div>

                      {/* Configurar / Cambiar PIN */}
                      {pinProfile.pin_enabled && pinProfile.pin_configured && pinStep === 'idle' && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setPinStep('enter-new'); setPinNewDigits([]); setPinConfirmDigits([]) }}
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <KeyRound className="w-4 h-4" />
                            {t('settings_pinChange')}
                          </button>

                          {/* Tiempo de bloqueo */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm text-muted-foreground">{t('settings_pinLockAfter')}</span>
                            <select
                              value={pinProfile.pin_timeout_minutes}
                              onChange={e => changeTimeout(Number(e.target.value))}
                              style={{
                                fontSize: '0.875rem',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid',
                                cursor: 'pointer',
                                backgroundColor: isDark ? 'oklch(0.22 0.02 260)' : 'oklch(0.95 0.01 260)',
                                color: isDark ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)',
                                borderColor: isDark ? 'oklch(0.28 0.02 260)' : 'oklch(0.90 0.01 260)',
                              }}
                            >
                              <option value={0}>{t('settings_pinImmediate')}</option>
                              <option value={1}>{t('settings_pin1min')}</option>
                              <option value={5}>{t('settings_pin5min')}</option>
                              <option value={15}>{t('settings_pin15min')}</option>
                              <option value={30}>{t('settings_pin30min')}</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Wizard: ingresar nuevo PIN */}
                      {(pinStep === 'enter-new' || pinStep === 'confirm-new') && (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-muted-foreground font-medium text-center">
                            {pinStep === 'enter-new' ? t('settings_pinEnterNew') : t('settings_pinConfirm')}
                          </p>

                          {/* Dots */}
                          <div className="flex gap-4 justify-center py-1">
                            {[0,1,2,3].map(i => {
                              const d = pinStep === 'enter-new' ? pinNewDigits : pinConfirmDigits
                              const primary = isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)'
                              const empty = isDark ? 'oklch(0.45 0.02 260)' : 'oklch(0.75 0.01 260)'
                              const filled = pinMismatch ? 'oklch(0.6 0.2 25)' : primary
                              return (
                                <div key={i} style={{
                                  width: '14px', height: '14px', borderRadius: '9999px', border: '2px solid',
                                  borderColor: i < d.length ? filled : empty,
                                  backgroundColor: i < d.length ? filled : 'transparent',
                                  transition: 'all 0.15s',
                                }} />
                              )
                            })}
                          </div>

                          {pinMismatch && (
                            <p className="text-xs text-destructive text-center">{t('settings_pinMismatch')}</p>
                          )}

                          {/* Keypad 3×4 */}
                          {(() => {
                            const keyBg = isDark ? 'oklch(0.22 0.02 260)' : 'oklch(0.91 0.01 260)'
                            const keyColor = isDark ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)'
                            const stepKey = pinStep === 'enter-new' ? 'new' : 'confirm'
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
                                {(['1','2','3','4','5','6','7','8','9','','0','del'] as const).map((k, idx) => {
                                  if (k === '') return <div key={idx} />
                                  if (k === 'del') return (
                                    <button key={idx} type="button"
                                      onClick={() => {
                                        if (pinStep === 'enter-new') setPinNewDigits(p => p.slice(0,-1))
                                        else setPinConfirmDigits(p => p.slice(0,-1))
                                      }}
                                      style={{ height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: keyColor }}
                                    >
                                      <Delete className="w-4 h-4" />
                                    </button>
                                  )
                                  return (
                                    <button key={idx} type="button"
                                      onClick={() => pinSetupDigit(k, stepKey)}
                                      disabled={pinSaving}
                                      style={{ height: '44px', borderRadius: '10px', fontSize: '1.1rem', fontWeight: '600', border: 'none', cursor: 'pointer', backgroundColor: keyBg, color: keyColor, transition: 'opacity 0.1s' }}
                                      onMouseDown={e => (e.currentTarget.style.opacity = '0.6')}
                                      onMouseUp={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                      {k}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })()}

                          <button
                            type="button"
                            onClick={() => { setPinStep('idle'); setPinNewDigits([]); setPinConfirmDigits([]) }}
                            className="text-xs text-muted-foreground hover:text-foreground w-full text-center pt-1"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      )}

                      {pinStep === 'done' && (
                        <div className="flex items-center gap-2 text-sm text-primary py-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {t('settings_pinSaved')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de volumen SOS */}
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      {t('settings_volume')}
                    </p>
                    <div className="rounded-lg border border-border p-3 space-y-4">

                      {/* Número de pulsaciones */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">{t('settings_volumePresses')}</span>
                          <span className="text-sm font-bold text-primary">{volumePresses}×</span>
                        </div>
                        <div className="flex gap-2">
                          {[3, 4, 5, 7, 10].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setVolumePresses(n)}
                              style={{
                                flex: 1,
                                padding: '6px 0',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                border: '1px solid',
                                cursor: 'pointer',
                                backgroundColor: volumePresses === n
                                  ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                                  : (isDark ? 'oklch(0.22 0.02 260)' : 'oklch(0.91 0.01 260)'),
                                borderColor: volumePresses === n
                                  ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                                  : (isDark ? 'oklch(0.28 0.02 260)' : 'oklch(0.90 0.01 260)'),
                                color: volumePresses === n ? 'white' : (isDark ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)'),
                              }}
                            >
                              {n}×
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ventana de tiempo */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">{t('settings_volumeWindow')}</span>
                          <span className="text-sm font-bold text-primary">{volumeWindow / 1000}s</span>
                        </div>
                        <div className="flex gap-2">
                          {[2000, 3000, 4000, 5000].map(ms => (
                            <button
                              key={ms}
                              type="button"
                              onClick={() => setVolumeWindow(ms)}
                              style={{
                                flex: 1,
                                padding: '6px 0',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                border: '1px solid',
                                cursor: 'pointer',
                                backgroundColor: volumeWindow === ms
                                  ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                                  : (isDark ? 'oklch(0.22 0.02 260)' : 'oklch(0.91 0.01 260)'),
                                borderColor: volumeWindow === ms
                                  ? (isDark ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)')
                                  : (isDark ? 'oklch(0.28 0.02 260)' : 'oklch(0.90 0.01 260)'),
                                color: volumeWindow === ms ? 'white' : (isDark ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)'),
                              }}
                            >
                              {ms / 1000}s
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {t('settings_volumeHint').replace('{n}', String(volumePresses)).replace('{s}', String(volumeWindow / 1000))}
                      </p>
                    </div>
                  </div>

                  {/* Plan Premium (individual) */}
                  <PremiumPlanSection />

                  {/* Plan Familiar */}
                  <FamilyPlanSection />

                  {/* Cuenta */}
                  <div>
                    <p className="text-sm font-medium mb-3">{t('settings_account')}</p>
                    <div className="p-3 rounded-lg border border-destructive/40 space-y-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={handleGoToDeleteAccount}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('settings_deleteAccount')}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {t('settings_deleteAccountNote')}
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {simpleMode && (
          <div className="bg-warning/20 border-b border-warning/30 px-4 py-1.5 flex items-center justify-center gap-2">
            <Puzzle className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-medium text-warning">{t('settings_simpleModeActive')}</span>
          </div>
        )}

        <main className={cn('flex-1 overflow-y-auto', simpleMode && 'text-lg')}>
          <div className="max-w-lg mx-auto px-4 py-4">
            {activeTab === 'home' && <HomeTab />}
            {activeTab === 'before' && <BeforeTab />}
            {activeTab === 'during' && <DuringTab />}
            {activeTab === 'after' && <AfterTab />}
            {activeTab === 'medic' && <MedicTab />}
          </div>
        </main>

        <SOSButton />
        <EmergencyChat />
        <BottomNavigation />
      </div>
    </PermissionGate>
  )
}
