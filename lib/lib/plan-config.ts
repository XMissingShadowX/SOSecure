/*
  Configuración del Plan Familiar de SOSecure.
  Fuente única de verdad para precio, límites y textos. Cámbialo aquí y
  se actualiza en toda la app (ajustes, página de pago, correos, API).
*/

export const FAMILY_PLAN = {
  id: 'family_annual',
  name: 'Plan Familiar Anual',
  // Hasta 5 usuarios EN TOTAL (incluye al titular)
  maxMembers: 5,
  // Precio anual. Cambia ambos valores juntos: el de centavos es el que
  // se cobra/registra, el formateado es solo para mostrar.
  currency: 'MXN',
  amountCents: 49900, // $499.00 MXN / año
  priceLabel: '$499 MXN',
  period: 'año',
  // Slogan de marca
  tagline: 'La tecnología que te cuida desde tu bolsillo',
  // Lista de beneficios mostrada en la página de pago
  benefits: [
    'Protege hasta 5 personas con una sola suscripción',
    'Botón SOS, video en vivo y ubicación en tiempo real para todos',
    'Contactos de emergencia y asistente médico para cada miembro',
    'Un solo pago al año, sin renovaciones sorpresa',
  ],
} as const

export type FamilyPlanConfig = typeof FAMILY_PLAN

/** Formatea centavos a moneda local (es-MX). */
export function formatAmount(cents: number, currency = FAMILY_PLAN.currency): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
