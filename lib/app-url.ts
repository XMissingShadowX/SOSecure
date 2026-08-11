/*
  URL pública de la app, en un solo lugar.

  Por qué existe: `process.env.NEXT_PUBLIC_APP_URL` se inlinea en build. Si la
  variable no está definida en Vercel, las plantillas que la interpolaban sin
  respaldo producían la cadena literal "undefined/..." — y eso llegó a
  producción en el link de la alerta SOS que se manda a los contactos.

  Reglas:
   - En cliente usa `clientAppUrl()`: `window.location.origin` siempre es el
     dominio real desde el que se cargó la página, así que no puede quedar mal
     aunque la variable falte.
   - En servidor usa `APP_URL`.
   - El respaldo lleva `www` a propósito: es el dominio canónico en Vercel, y
     `https://sosecure.site` responde 307 hacia él.
*/

const FALLBACK = 'https://www.sosecure.site'

// `||` y no `??`: una variable definida pero vacía también debe caer al respaldo.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || FALLBACK

/** URL de la app para código que corre en el navegador. */
export function clientAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return APP_URL
}
