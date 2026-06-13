/*
  Configuración de los planes de SOSecure.
  Fuente única de verdad para precios, límites, funciones y textos.
  Cámbialo aquí y se actualiza en toda la app (ajustes, páginas de pago,
  correos, API).
*/

// ───────────────────────────────────────────────────────────────
// PLAN FAMILIAR (suscripción anual, hasta 5 usuarios)
// ───────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────
// PLAN PREMIUM (suscripción mensual, individual)
// ───────────────────────────────────────────────────────────────
export const PREMIUM_PLAN = {
  id: 'premium_monthly',
  name: 'Plan Premium',
  currency: 'MXN',
  amountCents: 5900, // $59.00 MXN / mes
  priceLabel: '$59 MXN',
  period: 'mes',
  tagline: 'La tecnología que te cuida desde tu bolsillo',
  // Funciones que desbloquea el plan (se usan para "gatear" la UI).
  // Si cambias el límite de contactos, hazlo también aquí.
  features: {
    assistant: true,      // Asistente médico con IA
    discreetMode: true,   // Modo discreto
    maxContacts: 10,      // Hasta 10 contactos de emergencia
  },
  // Beneficios mostrados en la página de pago / ajustes
  benefits: [
    'Todo lo del plan gratis, sin límites',
    'Asistente médico con IA disponible 24/7',
    'Modo discreto para pedir ayuda sin que se note',
    'Hasta 10 contactos de emergencia',
  ],
} as const

export type PremiumPlanConfig = typeof PREMIUM_PLAN

// Límite de contactos del plan gratuito (para comparar en la UI).
export const FREE_MAX_CONTACTS = 2

/** Formatea centavos a moneda local (es-MX). */
export function formatAmount(cents: number, currency = FAMILY_PLAN.currency): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
