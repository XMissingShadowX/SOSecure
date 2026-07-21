# Trabajos opcionales y nuevas implementaciones

Lista de hallazgos que no son parte de ningún ticket de la auditoría actual — features
huérfanas, código muerto o mejoras razonables encontradas al paso. No urgentes, quedan
para cuando el equipo decida priorizarlas.

---

## 1. Reactivar el rastreo por link para contactos sin cuenta

**Qué hay:** un sistema completo (`hooks/use-tracking.ts`, `app/api/tracking-invite/route.ts`,
`app/api/tracking-location/route.ts`, `app/tracking/[sessionId]/page.tsx`) para compartir
ubicación en tiempo real con un contacto que **no tiene cuenta SOSecure**, vía un link con
token único mandado por correo. Quedó huérfano cuando el commit `5f26391` ("ubicacion en vivo
Life360") lo reemplazó por un sistema más simple (`useLiveLocation` / `toggleSharing`) que solo
funciona entre contactos que **ya tienen cuenta** — pero nunca se borró el código viejo, ni se
quitó su importación de `before-tab.tsx`, solo dejó de estar conectado a ningún botón.

**Por qué importa:** para una app de seguridad personal, que un contacto de confianza pueda ver
tu ubicación sin tener que instalar la app y crear cuenta en el momento de una emergencia es un
caso de uso central, no cosmético — es el mismo patrón que usan Find My compartido o Life360 en
sus flujos de invitado temporal.

**Estado:** el backend y la página receptora ya están completos y ya tienen los fixes de
seguridad de esta sesión aplicados (auth, Content-Type, límite de array). Solo falta el botón/UI
en `before-tab.tsx` que llame a `startTracking(...)`.

---

## 2. Carpeta `lib/app/` — copia vieja y muerta del flujo de plan familiar

**Qué hay:** `lib/app/plan-familiar/aceptar/page.tsx`, `lib/app/plan-familiar/pago/page.tsx` y
`lib/app/api/family/{accept,checkout,invite,webhook}/route.ts` — una copia completa y paralela
del flujo de plan familiar, viviendo fuera de `app/`, por lo que Next.js nunca la enruta.
Comparado con las versiones reales en `app/plan-familiar/*` y `app/api/family/*`, la copia en
`lib/app/` es una versión más vieja — le falta i18n (`useTranslation`) y el montaje seguro para
hidratación.

**Por qué importa:** no representa un riesgo funcional (nunca se ejecuta), pero es ruido que
puede llevar a alguien a editar la copia equivocada por error, y aumenta la superficie de
código a mantener sin necesidad.

**Sugerencia:** confirmar que nada la referencia y eliminarla.

---

## 3. `app/api/plan-premium/pago/page.tsx` — página de UI mal ubicada en el árbol de rutas de API

**Qué hay:** un `page.tsx` de 305 líneas viviendo dentro de `app/api/plan-premium/pago/` —
mezclando la convención de rutas de API con la de páginas. Es una versión más vieja de
`app/plan-premium/pago/page.tsx` (319 líneas, la que sí está enlazada desde
`PremiumPlanSection`), a la que le falta i18n y el ícono `ShieldCheck`.

**Por qué importa:** bajo riesgo funcional (la página real está en la ruta correcta y es la que
se usa), pero es el mismo tipo de duplicado confuso que el punto 2 — vale la pena limpiarlo en
el mismo barrido.

**Nota relacionada:** esta página (y su gemela en `lib/app/plan-familiar/pago/page.tsx`)
también tienen campos de tarjeta (`4242 4242 4242 4242`, `MM/AA`, `CVC`) que ya no están
conectados a ningún submit handler real — son restos visuales de antes de adoptar el checkout
por redirect a Mercado Pago/PayPal. No amerita línea aparte si de todos modos se borran estos
archivos.

---

## 4. Rate limiting del PIN — placeholder en memoria, no apto para producción con múltiples instancias

**Qué hay:** `app/api/pin/verify/route.ts:20-22` ya trae el comentario explícito:
> "Placeholder de rate limiting en memoria — NO persiste entre instancias serverless. En
> producción reemplazar por Redis/Upstash (o similar) compartido entre instancias."

**Por qué importa:** en Vercel (serverless), cada instancia tiene su propio `Map` en memoria —
si hay más de una instancia sirviendo tráfico, el límite de 5 intentos / 1 minuto de bloqueo no
es real, es solo por instancia. Ya estaba documentado como pendiente desde que se implementó el
fix de PIN server-side; queda como recordatorio de que sigue sin resolverse.

---

## 5. `PLAN_FREE_VS_PREMIUM.md` — verificar que siga reflejando el gating real

**Qué hay:** un documento a nivel raíz del repo que describe qué funciones son gratis vs
premium. No se verificó línea por línea contra `lib/plan-config.ts` / `usePremium()`.

**Por qué importa:** documentos de este tipo tienden a desincronizarse del código con el
tiempo. Vale la pena un repaso rápido para confirmar que el doc sigue siendo la fuente de
verdad correcta, sobre todo antes de usarlo para decisiones de producto o marketing.
