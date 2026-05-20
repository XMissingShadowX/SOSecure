/*
  ErrorBoundary es un componente que actúa como un límite de error para toda la aplicación.
- Captura errores de JavaScript en cualquier parte de su árbol de componentes hijo
- Evita que errores no manejados rompan toda la aplicación
- En caso de detectar un error relacionado con la carga de chunks (ChunkLoadError), recarga automáticamente la página para intentar resolver el problema
- Proporciona una experiencia de usuario más robusta al manejar fallos inesperados sin mostrar una pantalla rota
*/
'use client'
import { useEffect } from 'react'

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (event.message.includes('ChunkLoadError') || event.message.includes('Loading chunk')) {
        window.location.reload()
      }
    }
    window.addEventListener('error', handler)
    return () => window.removeEventListener('error', handler)
  }, [])

  return <>{children}</>
}