// Utility to send notifications instead of calls

export function sendAlarmNotification(title: string, body: string, urgent = false) {
  if (typeof window === 'undefined') return

  // Vibration pattern
  if (navigator.vibrate) {
    if (urgent) {
      navigator.vibrate([400, 100, 400, 100, 400, 100, 400])
    } else {
      navigator.vibrate([200, 100, 200])
    }
  }

  // Browser notification
  if (Notification.permission === 'granted') {
    const notif = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: urgent ? 'sosecure-sos' : 'sosecure-alert',
      requireInteraction: urgent,
      silent: false,
    })
    if (urgent) {
      notif.onclick = () => window.focus()
    }
    return notif
  }
}

export function sendSOSNotification(contactName: string, location: { latitude: number; longitude: number }) {
  const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
  sendAlarmNotification(
    '🚨 SOSecure - SOS Activado',
    `Alerta enviada a ${contactName}. Tu ubicación ha sido compartida.`,
    true
  )
  // Also try to send SMS via intent on mobile
  return mapsUrl
}

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
