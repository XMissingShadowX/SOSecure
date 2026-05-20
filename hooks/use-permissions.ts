/*
  El hook personalizado `usePermissions` se encarga de gestionar los permisos necesarios para el funcionamiento de 
  la aplicación, como geolocalización, notificaciones, cámara y micrófono. Proporciona funciones para solicitar 
  cada permiso individualmente, así como una función `requestAll` que solicita los permisos esenciales 
  (geolocalización y notificaciones) al mismo tiempo. El estado de los permisos se mantiene en un objeto 
  `permissions`, y también se proporciona un booleano `allGranted` para indicar si los permisos esenciales 
  han sido concedidos. El hook maneja tanto entornos nativos (usando Capacitor) como web, adaptándose a las 
  capacidades de cada plataforma.
*/

'use client'
import { useState, useEffect, useCallback } from 'react'

// Definición de tipos para los permisos que se manejarán en la aplicación, incluyendo geolocalización, 
// notificaciones, cámara y micrófono. El estado de cada permiso puede ser 'granted', 'denied', 'prompt' o 'unknown'.
export type PermissionName = 'geolocation' | 'notifications' | 'camera' | 'microphone'
export interface PermissionState {
  geolocation: PermissionStatus['state'] | 'unknown'
  notifications: PermissionStatus['state'] | 'unknown'
  camera: PermissionStatus['state'] | 'unknown'
  microphone: PermissionStatus['state'] | 'unknown'
}

// Función auxiliar para determinar si la aplicación se está ejecutando en un entorno nativo utilizando Capacitor. Esto es importante para decidir qué API de permisos utilizar, ya que los métodos para solicitar permisos 
// pueden variar entre plataformas web y nativas.
const isNative = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()

// El hook `usePermissions` proporciona el estado actual de los permisos, un indicador de si todos los permisos 
// esenciales han sido concedidos, y funciones para solicitar cada permiso individualmente o todos los permisos 
// esenciales a la vez.
export function usePermissions() {
  // Estado local para almacenar el estado de cada permiso. Inicialmente, todos los permisos se establecen como 'unknown'.
  const [permissions, setPermissions] = useState<PermissionState>({
    geolocation: 'unknown',
    notifications: 'unknown',
    camera: 'unknown',
    microphone: 'unknown',
  })
  // Booleano para indicar si todos los permisos esenciales (geolocalización y notificaciones) han sido concedidos.
  const [allGranted, setAllGranted] = useState(false)

  // Función para solicitar el permiso de geolocalización. En entornos nativos, utiliza la API de Capacitor, mientras 
  // que en web utiliza la API de Geolocation del navegador.
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

  // Función para solicitar el permiso de notificaciones. En entornos nativos, utiliza la API de Capacitor, 
  // mientras que en web utiliza la API de Notificaciones del navegador.
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

  // Función para solicitar el permiso de cámara. En entornos nativos, utiliza la API de Capacitor, mientras que en web 
  // utiliza la API de MediaDevices del navegador. Esta función se llama solo cuando el usuario necesita acceder a 
  // la cámara, como en situaciones de emergencia o para grabar, y no se incluye en la función `requestAll` 
  // para evitar solicitar permisos innecesarios al inicio.
  
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

  // Función para solicitar el permiso de micrófono. En entornos nativos, utiliza la API de Capacitor, mientras que en web 
  // utiliza la API de MediaDevices del navegador. Al igual que con la cámara, esta función se llama solo cuando el 
  // usuario necesita acceder al micrófono y no se incluye en `requestAll`.
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

  // La función `requestAll` solicita los permisos esenciales (geolocalización y notificaciones) al mismo tiempo. No 
  // solicita los permisos de cámara y micrófono, ya que estos se solicitan bajo demanda cuando el usuario los 
  // necesita. Después de solicitar los permisos esenciales, actualiza el estado de los permisos y el indicador 
  // `allGranted` en consecuencia.

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

  // useEffect para verificar el estado actual de los permisos cuando el componente se monta. En entornos nativos, 
  // utiliza la API de Capacitor para verificar los permisos, mientras que en web utiliza la API de Permisos del navegador.
  useEffect(() => {
    const check = async () => {
      // Verificar el estado de los permisos utilizando la API correspondiente según el entorno (nativo o web). 
      // En caso de error, se maneja silenciosamente para evitar interrupciones en la experiencia del usuario.
      try {
        // Si el entorno es nativo, verificar los permisos utilizando Capacitor.
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
        } 
        // Si el entorno es web, verificar los permisos utilizando la API de Permisos del navegador. Si esta API 
        // no está disponible, se maneja el estado de notificaciones como 'unknown'.
        else {
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
    // Verificar el estado de los permisos al montar el componente para reflejar correctamente la situación actual 
    // y evitar solicitar permisos innecesarios.
    check()
  }, [])

  // Devolver el estado actual de los permisos, el indicador de si todos los permisos esenciales han sido concedidos,
  // y las funciones para solicitar cada permiso individualmente o todos los permisos esenciales a la vez.
  return { permissions, allGranted, requestAll, requestGeolocation, requestNotifications, requestCamera, requestMicrophone }
}