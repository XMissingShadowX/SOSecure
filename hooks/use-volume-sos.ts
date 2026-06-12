'use client'

import { useEffect, useRef, useCallback } from 'react'
import { registerPlugin } from '@capacitor/core'

interface UseVolumeSOSOptions {
  onActivate: () => void
  disabled?: boolean
  pressesRequired?: number
  timeWindowMs?: number
}

interface VolumeButtonPlugin {
  addListener: (
    event: 'volumeButtonPressed',
    handler: (data: { button: string; timestamp: number }) => void
  ) => Promise<{ remove: () => void }>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
}

const VolumeButton = registerPlugin<VolumeButtonPlugin>('VolumeButton')

function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

export function useVolumeSOS({ onActivate, disabled = false, pressesRequired = 5, timeWindowMs = 3000 }: UseVolumeSOSOptions) {
  const pressTimesRef  = useRef<number[]>([])
  const listenerRef    = useRef<{ remove: () => void } | null>(null)
  // Mantener referencia estable a onActivate para evitar re-ejecuciones de efectos.
  const onActivateRef  = useRef(onActivate)
  useEffect(() => { onActivateRef.current = onActivate }, [onActivate])

  const handlePressRef = useRef<() => void>(() => {})
  handlePressRef.current = () => {
    if (disabled) return
    const now = Date.now()
    pressTimesRef.current = [
      ...pressTimesRef.current.filter(t => now - t < timeWindowMs),
      now,
    ]
    if (pressTimesRef.current.length >= pressesRequired) {
      pressTimesRef.current = []
      onActivateRef.current()
    }
  }

  // ── Android nativo: VolumeButtonPlugin ──────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform() || disabled) return

    let cancelled = false

    const setup = async () => {
      try {
        await VolumeButton.startListening()

        const handle = await VolumeButton.addListener('volumeButtonPressed', () => {
          if (!cancelled) handlePressRef.current()
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
      VolumeButton.stopListening().catch(() => {})
    }
  }, [disabled])

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
        handlePressRef.current()
      }
    }

    // Fallback: volumechange en el documento (funciona si hay un <video>/<audio>
    // activo en la página con el que el usuario ya interactuó).
    const onVolumeChange = () => handlePressRef.current()

    window.addEventListener('keydown', onKeyDown, { capture: true })
    document.addEventListener('volumechange', onVolumeChange, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      document.removeEventListener('volumechange', onVolumeChange, { capture: true })
    }
  }, [disabled])
}
