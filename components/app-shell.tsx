/*
  AppShell es el componente raíz que envuelve toda la aplicación. Se encarga de:
- Gestionar el estado global de la aplicación (ubicación, incidentes cercanos, tema, usuario)
- Manejar la geolocalización y sincronización de datos con Supabase
- Renderizar la estructura principal de la UI (header, main, navegación)
- Proporcionar un contexto para los permisos necesarios para el funcionamiento de la app 
  (geolocalización, notificaciones, etc.)
*/

'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { createClient } from '@/lib/supabase/client'
import { PermissionGate } from './permission-gate'
import { BottomNavigation } from './bottom-navigation'
import { SOSButton } from './sos-button'
import { EmergencyChat } from './emergency-chat'
import { HomeTab } from './tabs/home-tab'
import { MedicTab } from './tabs/medic-tab'
import { BeforeTab } from './tabs/before-tab'
import { DuringTab } from './tabs/during-tab'
import { AfterTab } from './tabs/after-tab'
import { Shield, Settings, LogOut, BellRing, WifiOff, Sun, Moon, UserCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const { activeTab, setCurrentLocation, setNearbyIncidents, offlineQueue } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })
  const [user, setUser] = useState<User | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isDark, setIsDark] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const applyTheme = (theme: string) => {
    const isDarkTheme = theme === 'dark'
    const bg = isDarkTheme ? 'oklch(0.13 0.01 260)' : 'oklch(0.98 0.005 260)'
    const fg = isDarkTheme ? 'oklch(0.95 0.01 260)' : 'oklch(0.15 0.01 260)'
    const card = isDarkTheme ? 'oklch(0.17 0.01 260)' : 'oklch(1 0 0)'
    const border = isDarkTheme ? 'oklch(0.28 0.02 260)' : 'oklch(0.90 0.01 260)'
    const muted = isDarkTheme ? 'oklch(0.22 0.02 260)' : 'oklch(0.95 0.01 260)'
    const primary = isDarkTheme ? 'oklch(0.75 0.15 180)' : 'oklch(0.55 0.15 180)'

    document.body.style.backgroundColor = bg
    document.body.style.color = fg

    document.querySelectorAll<HTMLElement>('.bg-background, .min-h-screen, header, nav').forEach(el => {
      el.style.backgroundColor = bg
      el.style.color = fg
    })

    document.querySelectorAll<HTMLElement>('.text-muted-foreground').forEach(el => {
      el.style.color = isDarkTheme ? 'oklch(0.65 0.02 260)' : 'oklch(0.45 0.02 260)'
    })

    document.querySelectorAll<HTMLElement>('.bg-card, [class*="card"]').forEach(el => {
      if (el.tagName === 'BUTTON') return
      if (el.classList.contains('leaflet-container') || el.closest('.leaflet-container')) return
      el.style.backgroundColor = card
      el.style.color = fg
      el.style.borderColor = border
    })

    document.querySelectorAll<HTMLElement>('.bg-muted, [class*="muted"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.closest('nav')) return
      el.style.backgroundColor = muted
    })

    document.querySelectorAll<HTMLElement>('nav button').forEach(el => {
      el.style.backgroundColor = 'transparent'
    })

    // Limpiar estilos inline de botones del nav y dejar que React maneje sus colores
    document.querySelectorAll<HTMLElement>('nav button').forEach(el => {
      el.style.backgroundColor = 'transparent'
      el.style.color = ''  // quita el color inline para que React tome control
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
    }
  }, [coordinates, setCurrentLocation])

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

  return (
    <PermissionGate>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border safe-area-top">
          <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
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

                <div className="space-y-6 pt-2">
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

        <main className="flex-1 overflow-y-auto">
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