/*
  BottomNavigation es el componente que renderiza la barra de navegación inferior en la aplicación.
- Define las pestañas principales de la aplicación (Inicio, Antes, Mapa, Durante, Después, Rutas, Apoyo)
- Permite al usuario cambiar entre las diferentes secciones de la app
- Resalta la pestaña activa para mejorar la experiencia de navegación
- Es un componente fijo que siempre está accesible en la parte inferior de la pantalla, incluso al hacer scroll
- Utiliza íconos para una identificación visual rápida de cada sección
*/

'use client'

import { Home, Brain, TriangleAlert, Radio, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import type { TabId } from '@/lib/types'

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'before', label: 'Antes', icon: TriangleAlert },
  { id: 'during', label: 'Durante', icon: Radio },
  { id: 'after', label: 'Después', icon: CheckCircle },
  { id: 'medic', label: 'Apoyo', icon: Brain },
]

export function BottomNavigation() {
  const { activeTab, setActiveTab, simpleMode } = useAppStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className={cn('flex items-center w-full max-w-lg mx-auto', simpleMode ? 'h-20' : 'h-16')}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors',
                simpleMode ? 'py-3' : 'py-2',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn(simpleMode ? 'w-7 h-7' : 'w-5 h-5', isActive && 'text-primary')} />
              <span className={cn(simpleMode ? 'text-xs font-semibold' : 'text-[10px] font-medium', isActive && 'text-primary')}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
