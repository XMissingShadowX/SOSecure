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
  const pressTimesRef = useRef<number[]>([])
  const listenerRef   = useRef<{ remove: () => void } | null>(null)

  const handlePress = useCallback(() => {
    if (disabled) return

    const now = Date.now()
    pressTimesRef.current = [
      ...pressTimesRef.current.filter(t => now - t < TIME_WINDOW_MS),
      now,
    ]

    if (pressTimesRef.current.length >= PRESSES_REQUIRED) {
      pressTimesRef.current = []
      onActivate()
    }
  }, [disabled, onActivate])

  // ── Android nativo: VolumeButtonPlugin ──────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform()) return

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

    if (!disabled) setup()

    return () => {
      cancelled = true
      listenerRef.current?.remove()
      listenerRef.current = null

      const plugin = window.Capacitor?.Plugins?.VolumeButton as CapacitorPlugin | undefined
      plugin?.call('stopListening').catch(() => {})
    }
  }, [disabled, handlePress])

  // ── Web / PWA: evento volumechange ──────────────────────────────────────
  useEffect(() => {
    if (isNativePlatform() || disabled) return

    const audio = document.createElement('audio')
    audio.src    = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsBAADYCwAAAgAMACAAAABkYXRhAAAA'
    audio.loop   = true
    audio.volume = 0.001
    audio.play().catch(() => {})

    const onVolumeChange = () => handlePress()
    audio.addEventListener('volumechange', onVolumeChange)

    return () => {
      audio.removeEventListener('volumechange', onVolumeChange)
      audio.pause()
      audio.src = ''
    }
  }, [disabled, handlePress])
}