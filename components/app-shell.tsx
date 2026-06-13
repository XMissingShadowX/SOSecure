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
import { Shield, Settings, LogOut, BellRing, WifiOff, Sun, Moon, UserCircle, Trash2, Lock, LockOpen, KeyRound, CheckCircle2, Delete, ShieldCheck, Volume2, Puzzle } from 'lucide-react'
import { PinLock } from './pin-lock'
import { hashPin } from '@/lib/pin'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { User } from '@supabase/supabase-js'

export function AppShell() {
  const { activeTab, setCurrentLocation, setLocationStatus, setNearbyIncidents, offlineQueue, isLiveSharing, voiceKeyword, sosActive, volumePresses, setVolumePresses, volumeWindow, setVolumeWindow, simpleMode, setSimpleMode } = useAppStore()
  const { coordinates, loading: locationLoading, error: locationError } = useGeolocation({ watch: true })
  const [user, setUser] = useState<User | null>(null)
  const liveBroadcastRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceRecognitionRef = useRef<any>(null)
  const sosActiveRef = useRef(sosActive)
  const voicePausedRef = useRef(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isDark, setIsDark] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // PIN state
  const [pinLocked, setPinLocked] = useState(false)
  const [pinProfile, setPinProfile] = useState<{
    pin_enabled: boolean
    pin_hash: string | null
    pin_timeout_minutes: number
  }>({ pin_enabled: false, pin_hash: null, pin_timeout_minutes: 5 })
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
  // Solo se recrea cuando cambia la palabra clave; sosActive se lee desde la ref para evitar closures stale.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return

    if (voiceRecognitionRef.current) {
      try { voiceRecognitionRef.current.stop() } catch { /* ignore */ }
      voiceRecognitionRef.current = null
    }

    if (!voiceKeyword) return

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.lang = navigator.language.startsWith('es') ? navigator.language : 'es'
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      if (sosActiveRef.current) return
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase()
      if (transcript.includes(voiceKeyword)) {
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
  }, [voiceKeyword])

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
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('pin_enabled, pin_hash, pin_timeout_minutes')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        const profile = {
          pin_enabled: data.pin_enabled ?? false,
          pin_hash: data.pin_hash ?? null,
          pin_timeout_minutes: data.pin_timeout_minutes ?? 5,
        }
        setPinProfile(profile)

        if (!profile.pin_enabled || !profile.pin_hash) return

        const lastActive = sessionStorage.getItem('sosecure-last-active')
        if (!lastActive) {
          setPinLocked(true)
          return
        }
        const elapsed = (Date.now() - parseInt(lastActive)) / 60000
        if (elapsed >= profile.pin_timeout_minutes) {
          setPinLocked(true)
        }
      })
  }, [user])

  // Track visibility changes to enforce PIN timeout
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('sosecure-last-active', Date.now().toString())
      } else if (document.visibilityState === 'visible' && pinProfile.pin_enabled && pinProfile.pin_hash) {
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

  const savePinSetup = async (pin: string) => {
    if (!user) return
    setPinSaving(true)
    const hash = await hashPin(pin, user.id)
    await fetch('/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_hash: hash, pin_enabled: true }),
    })
    setPinProfile(prev => ({ ...prev, pin_enabled: true, pin_hash: hash }))
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
      // If hash exists, just enable; otherwise start setup
      if (pinProfile.pin_hash) {
        await fetch('/api/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin_enabled: true }),
        })
        setPinProfile(prev => ({ ...prev, pin_enabled: true }))
      } else {
        setPinStep('enter-new')
      }
    }
  }

  const changeTimeout = async (minutes: number) => {
    if (!user) return
    await fetch('/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_timeout_minutes: minutes }),
    })
    setPinProfile(prev => ({ ...prev, pin_timeout_minutes: minutes }))
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    setDeleteError(null)
    const res = await fetch('/api/delete-account', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/auth/login'
    } else {
      const body = await res.json().catch(() => ({}))
      setDeleteError(body.error ?? 'Error al eliminar la cuenta')
      setDeletingAccount(false)
    }
  }

  // Render PIN lock overlay (takes over the entire screen)
  if (pinLocked && pinProfile.pin_hash && user) {
    if (forgotPinSent) {
      return (
        <div className="fixed inset-0 z-[99999] bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Revisa tu correo</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enviamos un enlace a <strong>{user.email}</strong> para restablecer tu PIN. Al ingresar, podrás configurar uno nuevo.
          </p>
        </div>
      )
    }
    return (
      <PinLock
        userId={user.id}
        pinHash={pinProfile.pin_hash}
        onUnlock={handlePinUnlock}
        onForgotPin={handleForgotPin}
      />
    )
  }

  return (
    <PermissionGate>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border safe-area-top">
          <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">SOSecure</span>
              {!isOnline && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/20 rounded-full">
                  <WifiOff className="w-3 h-3 text-warning" />
                  <span className="text-xs text-warning font-medium">Sin internet</span>
                </div>
              )}
              {offlineQueue.length > 0 && isOnline && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 rounded-full">
                  <BellRing className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary font-medium">{offlineQueue.length} sync</span>
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
                <DropdownMenuContent align="end" className="z-[9999] bg-popover text-popover-foreground">
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
                    Ajustes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Dialog de Ajustes */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Ajustes</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto pr-1">
                  {/* Modo Simple */}
                  <div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-primary/5">
                      <div className="flex items-center gap-2">
                        <Puzzle className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Modo Simple</p>
                          <p className="text-xs text-muted-foreground">Interfaz más grande y fácil de usar</p>
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

                  {/* Tema */}
                  <div>
                    <p className="text-sm font-medium mb-3">Apariencia</p>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        <span className="text-sm">{isDark ? 'Tema oscuro' : 'Tema claro'}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={toggleTheme}>
                        {isDark ? <Sun className="w-4 h-4 mr-1" /> : <Moon className="w-4 h-4 mr-1" />}
                        {isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
                      </Button>
                    </div>
                  </div>

                  {/* PIN de seguridad */}
                  <div>
                    <p className="text-sm font-medium mb-3">PIN de seguridad</p>
                    <div className="rounded-lg border border-border p-3 space-y-3">

                      {/* Toggle activar/desactivar — inline styles para evitar override del tema */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Activar PIN</span>
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
                            backgroundColor: pinProfile.pin_enabled && pinProfile.pin_hash
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
                            transform: pinProfile.pin_enabled && pinProfile.pin_hash ? 'translateX(24px)' : 'translateX(4px)',
                          }} />
                        </button>
                      </div>

                      {/* Configurar / Cambiar PIN */}
                      {pinProfile.pin_enabled && pinProfile.pin_hash && pinStep === 'idle' && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setPinStep('enter-new'); setPinNewDigits([]); setPinConfirmDigits([]) }}
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <KeyRound className="w-4 h-4" />
                            Cambiar PIN
                          </button>

                          {/* Tiempo de bloqueo */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm text-muted-foreground">Bloquear tras</span>
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
                              <option value={1}>1 minuto</option>
                              <option value={5}>5 minutos</option>
                              <option value={15}>15 minutos</option>
                              <option value={30}>30 minutos</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Wizard: ingresar nuevo PIN */}
                      {(pinStep === 'enter-new' || pinStep === 'confirm-new') && (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-muted-foreground font-medium text-center">
                            {pinStep === 'enter-new' ? 'Ingresa tu nuevo PIN (4 dígitos)' : 'Confirma tu nuevo PIN'}
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
                            <p className="text-xs text-destructive text-center">Los PINs no coinciden, intenta de nuevo</p>
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
                            Cancelar
                          </button>
                        </div>
                      )}

                      {pinStep === 'done' && (
                        <div className="flex items-center gap-2 text-sm text-primary py-1">
                          <CheckCircle2 className="w-4 h-4" />
                          PIN configurado correctamente
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de volumen SOS */}
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      Activación por volumen
                    </p>
                    <div className="rounded-lg border border-border p-3 space-y-4">

                      {/* Número de pulsaciones */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Pulsaciones requeridas</span>
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
                          <span className="text-sm text-muted-foreground">Ventana de tiempo</span>
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
                        Presiona volumen <strong>{volumePresses}×</strong> en menos de <strong>{volumeWindow / 1000}s</strong> para activar el SOS.
                      </p>
                    </div>
                  </div>

                  {/* Plan Premium (individual) */}
                  <PremiumPlanSection />

                  {/* Plan Familiar */}
                  <FamilyPlanSection />

                  {/* Cuenta */}
                  <div>
                    <p className="text-sm font-medium mb-3">Cuenta</p>
                    <div className="p-3 rounded-lg border border-destructive/40 space-y-2">
                      {deleteError && (
                        <p className="text-xs text-destructive">{deleteError}</p>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="w-full" disabled={deletingAccount}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción es permanente. Se borrarán todos tus datos y no podrás recuperarlos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={handleDeleteAccount}
                            >
                              Sí, eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <p className="text-xs text-muted-foreground">
                        Si no inicias sesión en 30 días, tu cuenta será eliminada permanentemente.
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
            <span className="text-xs font-medium text-warning">Modo Simple activado</span>
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
