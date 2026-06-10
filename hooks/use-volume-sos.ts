'use client'

import { useEffect, useRef, useCallback } from 'react'

const PRESSES_REQUIRED = 5
const TIME_WINDOW_MS   = 3000

interface UseVolumeSOSOptions {
  onActivate: () => void
  disabled?: boolean
}

interface CapacitorPlugin {
  addListener: (
    event: string,
    handler: (data: { button: string; timestamp: number }) => void
  ) => Promise<{ remove: () => void }>
  call: (method: string) => Promise<void>
}

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean
      Plugins?: Record<string, CapacitorPlugin>
    }
  }
}

function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

export function useVolumeSOS({ onActivate, disabled = false }: UseVolumeSOSOptions) {
  const pressTimesRef  = useRef<number[]>([])
  const listenerRef    = useRef<{ remove: () => void } | null>(null)
  // Mantener referencia estable a onActivate para evitar re-ejecuciones de efectos.
  const onActivateRef  = useRef(onActivate)
  useEffect(() => { onActivateRef.current = onActivate }, [onActivate])

  const handlePress = useCallback(() => {
    if (disabled) return
    const now = Date.now()
    pressTimesRef.current = [
      ...pressTimesRef.current.filter(t => now - t < TIME_WINDOW_MS),
      now,
    ]
    if (pressTimesRef.current.length >= PRESSES_REQUIRED) {
      pressTimesRef.current = []
      onActivateRef.current()
    }
  }, [disabled])

  // ── Android nativo: VolumeButtonPlugin ──────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform() || disabled) return

    let cancelled = false

    const setup = async () => {
      try {
        const plugin = window.Capacitor?.Plugins?.VolumeButton as CapacitorPlugin | undefined
        if (!plugin) return

        await plugin.call('startListening')

        const handle = await plugin.addListener('volumeButtonPressed', () => {
          if (!cancelled) handlePress()
        })

        listenerRef.current = handle
      } catch (err) {
        console.warn('[useVolumeSOS] Error al iniciar VolumeButtonPlugin:', err)
      }
    }

    setup()

    return () => {
      cancelled = true
      listenerRef.current?.remove()
      listenerRef.current = null
      const plugin = window.Capacitor?.Plugins?.VolumeButton as CapacitorPlugin | undefined
      plugin?.call('stopListening').catch(() => {})
    }
  }, [disabled, handlePress])

  // ── Web / PWA: KeyboardEvent para teclas de volumen (MediaSession API) ──
  // Los navegadores de escritorio exponen ArrowUp/ArrowDown con MediaSession,
  // pero la forma más confiable en web es escuchar el evento 'keydown' para
  // las teclas de volumen (Android Chrome las emite como 'AudioVolumeUp' /
  // 'AudioVolumeDown'). Como fallback adicional, se escucha 'volumechange'
  // en un <video> que el usuario haya interactuado previamente.
  useEffect(() => {
    if (isNativePlatform() || disabled) return

    // Teclas de volumen físicas en Android Chrome PWA y algunos escritorios.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown' ||
          e.key === 'VolumeUp'      || e.key === 'VolumeDown') {
        e.preventDefault()
        handlePress()
      }
    }

    // Fallback: volumechange en el documento (funciona si hay un <video>/<audio>
    // activo en la página con el que el usuario ya interactuó).
    const onVolumeChange = () => handlePress()

    window.addEventListener('keydown', onKeyDown, { capture: true })
    document.addEventListener('volumechange', onVolumeChange, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      document.removeEventListener('volumechange', onVolumeChange, { capture: true })
    }
  }, [disabled, handlePress])
}
