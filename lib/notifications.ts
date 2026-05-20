/*
  Este módulo define funciones para enviar notificaciones de alarma y SOS al usuario utilizando la API de 
  Notificaciones del navegador. La función `sendAlarmNotification` envía una notificación de alarma con un 
  título, cuerpo y una opción para marcarla como urgente. Si la notificación es urgente, también se activa un 
  patrón de vibración más intenso. La función `sendSOSNotification` envía una notificación de SOS a un contacto 
  específico y comparte la ubicación del usuario. Además, la función `playAlarmSound` reproduce un sonido de 
  alarma utilizando la API de Audio del navegador. Estas funciones son útiles para alertar al usuario en 
  situaciones de emergencia o para enviar notificaciones importantes relacionadas con la seguridad.
*/

// Función para enviar una notificación de alarma al usuario, con opciones para marcarla como urgente y activar vibración.
export async function sendAlarmNotification(title: string, body: string, urgent = false) {
  if (typeof window === 'undefined') return

  // Vibration pattern
  if (navigator.vibrate) {
    navigator.vibrate(urgent ? [400, 100, 400, 100, 400, 100, 400] : [200, 100, 200])
  }

  // Browser notification
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  if (navigator.serviceWorker?.controller) {
    // Móvil / PWA: new Notification() no está permitido, usar ServiceWorker
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: urgent ? 'sosecure-sos' : 'sosecure-alert',
      requireInteraction: urgent,
      silent: false,
    })
  } else {
    // Desktop: new Notification() funciona directo
    const notif = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: urgent ? 'sosecure-sos' : 'sosecure-alert',
      requireInteraction: urgent,
      silent: false,
    })
    if (urgent) notif.onclick = () => window.focus()
    return notif
  }
}

// Función para enviar una notificación de SOS a un contacto específico, compartiendo la ubicación del usuario.
export function sendSOSNotification(contactName: string, location: { latitude: number; longitude: number }) {
  const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
  sendAlarmNotification(
    '🚨 SOSecure - SOS Activado',
    `Alerta enviada a ${contactName}. Tu ubicación ha sido compartida.`,
    true
  )
  return mapsUrl
}

// Función para reproducir un sonido de alarma utilizando la API de Audio del navegador.
export function playAlarmSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.2)
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.4)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.8)
  } catch {
    // Audio not available
  }
}