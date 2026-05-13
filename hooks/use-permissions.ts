'use client'
import { useState, useEffect, useCallback } from 'react'

export type PermissionName = 'geolocation' | 'notifications' | 'camera' | 'microphone'
export interface PermissionState {
  geolocation: PermissionStatus['state'] | 'unknown'
  notifications: PermissionStatus['state'] | 'unknown'
  camera: PermissionStatus['state'] | 'unknown'
  microphone: PermissionStatus['state'] | 'unknown'
}

const isNative = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionState>({
    geolocation: 'unknown',
    notifications: 'unknown',
    camera: 'unknown',
    microphone: 'unknown',
  })
  const [allGranted, setAllGranted] = useState(false)

  const requestGeolocation = useCallback(async () => {
    try {
      if (isNative()) {
        const { Geolocation } = await import('@capacitor/geolocation')
        const result = await Geolocation.requestPermissions()
        return result.location === 'granted'
      }
      return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false))
      })
    } catch { return false }
  }, [])

  const requestNotifications = useCallback(async () => {
    try {
      if (isNative()) {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        const result = await LocalNotifications.requestPermissions()
        return result.display === 'granted'
      }
      if (typeof Notification !== 'undefined') {
        const result = await Notification.requestPermission()
        return result === 'granted'
      }
      return false
    } catch { return false }
  }, [])

  // Cámara y micrófono se piden SOLO cuando el usuario los necesita (SOS, grabar)
  // No se llaman en requestAll
  const requestCamera = useCallback(async () => {
    try {
      if (isNative()) {
        const { Camera } = await import('@capacitor/camera')
        const result = await Camera.requestPermissions({ permissions: ['camera'] })
        return result.camera === 'granted'
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setPermissions(prev => ({ ...prev, camera: 'granted' }))
      return true
    } catch {
      setPermissions(prev => ({ ...prev, camera: 'denied' }))
      return false
    }
  }, [])

  const requestMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setPermissions(prev => ({ ...prev, microphone: 'granted' }))
      return true
    } catch {
      setPermissions(prev => ({ ...prev, microphone: 'denied' }))
      return false
    }
  }, [])

  // requestAll solo pide lo estrictamente necesario para que la app funcione:
  // ubicación y notificaciones. Cámara y micrófono se piden bajo demanda.
  const requestAll = useCallback(async () => {
    const geo = await requestGeolocation()
    const notif = await requestNotifications()

    const newState: PermissionState = {
      geolocation: geo ? 'granted' : 'denied',
      notifications: notif ? 'granted' : 'denied',
      camera: permissions.camera,    // mantener estado actual, no pedir
      microphone: permissions.microphone, // mantener estado actual, no pedir
    }
    setPermissions(newState)
    setAllGranted(geo && notif)
    return newState
  }, [requestGeolocation, requestNotifications, permissions.camera, permissions.microphone])

  useEffect(() => {
    const check = async () => {
      try {
        if (isNative()) {
          const { Geolocation } = await import('@capacitor/geolocation')
          const { Camera } = await import('@capacitor/camera')
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const [geo, cam, notif] = await Promise.all([
            Geolocation.checkPermissions(),
            Camera.checkPermissions(),
            LocalNotifications.checkPermissions(),
          ])
          const state: PermissionState = {
            geolocation: geo.location === 'granted' ? 'granted' : 'prompt',
            camera: cam.camera === 'granted' ? 'granted' : 'prompt',
            notifications: notif.display === 'granted' ? 'granted' : 'prompt',
            microphone: 'unknown',
          }
          setPermissions(state)
          setAllGranted(state.geolocation === 'granted' && state.notifications === 'granted')
        } else {
          // Solo verificar estado actual sin disparar popups
          const results = await Promise.all([
            navigator.permissions.query({ name: 'geolocation' }),
            navigator.permissions.query({ name: 'notifications' }),
            navigator.permissions.query({ name: 'camera' as PermissionName }),
            navigator.permissions.query({ name: 'microphone' as PermissionName }),
          ]).catch(() => null)

          if (results) {
            const [geo, notif, cam, mic] = results
            const state: PermissionState = {
              geolocation: geo.state,
              notifications: notif.state,
              camera: cam.state,
              microphone: mic.state,
            }
            setPermissions(state)
            setAllGranted(geo.state === 'granted' && notif.state === 'granted')
          } else {
            const notifState = typeof Notification !== 'undefined'
              ? Notification.permission === 'granted' ? 'granted'
                : Notification.permission === 'denied' ? 'denied' : 'prompt'
              : 'unknown'
            setPermissions(prev => ({ ...prev, notifications: notifState as PermissionStatus['state'] }))
          }
        }
      } catch { /* silently fail */ }
    }
    check()
  }, [])

  return { permissions, allGranted, requestAll, requestGeolocation, requestNotifications, requestCamera, requestMicrophone }
}