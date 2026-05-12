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