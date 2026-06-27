# SOSecure — Claude Code Instructions

## Descripción del Proyecto

**SOSecure** es una app de seguridad personal que permite a usuarios activar alertas SOS, compartir ubicación en tiempo real, reportar incidentes comunitarios y recibir apoyo psicológico mediante IA. Se despliega como **PWA (Next.js)** y como **APK Android** vía Capacitor.

**Audiencia:** Personas en situaciones de riesgo o emergencia, y sus contactos de confianza.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router, static export) |
| UI | React 19 + Tailwind CSS 3 + shadcn/ui (Radix UI) |
| Estado global | Zustand 5 con persistencia en localStorage |
| Backend/Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| IA | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Mapas | Leaflet + react-leaflet + leaflet.heat |
| Rutas | OSRM (Open Source Routing Machine) |
| Mobile | Capacitor 8 (Android) |
| Email | Resend API |
| Gráficas | recharts |
| Iconos | lucide-react |
| Fechas | date-fns |
| i18n | Sistema propio (`lib/i18n.ts`) — es, en, nah, myn, tze |

---

## Comandos Esenciales

```bash
# Desarrollo
npm run dev           # Puerto 3000
npm run dev:3001      # Puerto 3001

# Producción
npm run build         # Compilar Next.js
npm run export        # Build + export estático (genera /out)
npm run start         # Servidor de producción

# Android / Capacitor
npm run cap:sync      # Sincronizar build con Capacitor
npm run cap:android   # Abrir Android Studio

# Linting
npm run lint
```

---

## Variables de Entorno (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
NEXT_PUBLIC_ANTHROPIC_API_KEY=
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox         # o 'live' para producción
PAYPAL_WEBHOOK_ID_FAMILY=   # ID del webhook en PayPal Developer Dashboard (plan familiar)
PAYPAL_WEBHOOK_ID_PREMIUM=  # ID del webhook en PayPal Developer Dashboard (plan premium)

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET= # Clave secreta generada en el panel de MP → Webhooks

# App
NEXT_PUBLIC_APP_URL=https://sosecure.site
```

> **Nunca** commitear `.env.local`. Ya está en `.gitignore`.

---

## Estructura de Carpetas

```
SOSecure/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Home: check auth + splash screen
│   ├── layout.tsx              # Root layout (PWA metadata)
│   ├── globals.css             # Variables CSS globales
│   ├── admin/                  # Panel de administración
│   ├── auth/                   # Login, sign-up, callback, error
│   ├── api/                    # API Routes
│   │   ├── chat/               # Chat IA con Claude
│   │   ├── emergency-chat/     # Chat de emergencias
│   │   ├── delete-account/     # Borrar cuenta
│   │   ├── pin/                # Gestión de PIN de seguridad
│   │   ├── tracking-location/  # Ubicación en tiempo real
│   │   ├── tracking-invite/    # Invitaciones de tracking
│   │   └── family/             # Plan familiar (invites, pagos, webhook)
│   ├── emergency/[alertId]/    # Página pública de alerta SOS activa
│   ├── tracking/[sessionId]/   # Sesión de rastreo compartido
│   ├── plan-familiar/          # Pago y aceptación del plan familiar
│   ├── privacidad/             # Política de privacidad
│   └── terminos/               # Términos y condiciones
│
├── components/
│   ├── tabs/                   # Pantallas principales (una por tab)
│   │   ├── home-tab.tsx        # Ubicación, contactos, lugares frecuentes
│   │   ├── before-tab.tsx      # Planificación de ruta, temporizador, zonas seguras
│   │   ├── during-tab.tsx      # Grabación en vivo, reporte de incidentes
│   │   ├── after-tab.tsx       # Votación de incidentes
│   │   ├── medic-tab.tsx       # Chat de apoyo psicológico (Claude)
│   │   ├── map-tab.tsx         # Mapa comunitario de incidentes
│   │   └── routes-tab.tsx      # Cálculo de rutas con OSRM
│   ├── app-shell.tsx           # Wrapper principal: tabs + botón SOS + configuración
│   ├── sos-button.tsx          # Botón SOS (hold 1s / volumen 5x / voz)
│   ├── incident-map.tsx        # Mapa Leaflet con marcadores y heatmap
│   ├── emergency-chat.tsx      # Interfaz de chat de emergencias
│   ├── route-map.tsx           # Mapa con puntuación de seguridad de rutas
│   ├── family-plan-section.tsx # UI del plan familiar
│   ├── pin-lock.tsx            # Pantalla de PIN de seguridad
│   ├── permission-gate.tsx     # Solicitud de permisos del dispositivo
│   ├── bottom-navigation.tsx   # Barra de navegación inferior
│   ├── error-boundary.tsx      # Manejo de errores React
│   ├── theme-provider.tsx      # Tema claro/oscuro
│   └── ui/                     # Componentes shadcn/ui (no editar directamente)
│
├── hooks/
│   ├── use-geolocation.ts      # GPS con modo watch
│   ├── use-volume-sos.ts       # Activación SOS con botones de volumen
│   ├── use-tracking.ts         # Iniciar/gestionar sesión de rastreo
│   ├── use-incoming-tracking.ts # Recibir ubicación de otros
│   ├── use-live-location.ts    # Transmitir ubicación en tiempo real
│   ├── use-contact-user-ids.ts # Mapear contactos a IDs de Supabase
│   └── use-permissions.ts      # Solicitar permisos del dispositivo
│
├── lib/
│   ├── store.ts                # Estado global Zustand (persistido)
│   ├── types.ts                # Interfaces TypeScript del dominio
│   ├── utils.ts                # Utilidades (cn() para clases)
│   ├── notifications.ts        # Notificaciones push y alarmas
│   ├── recordings.ts           # Grabación de audio/video
│   ├── pin.ts                  # Hash y validación de PIN
│   ├── family.ts               # Lógica del plan familiar
│   ├── live-stream.ts          # Transmisión de ubicación en vivo
│   ├── incident-reminder.ts    # Recordatorios de incidentes
│   ├── plan-config.ts          # Configuración del plan familiar
│   └── supabase/
│       ├── client.ts           # Cliente Supabase (browser)
│       └── server.ts           # Cliente Supabase (server-side)
│
├── types/                      # Tipos TypeScript adicionales
├── supabase/                   # Configuración y migraciones de Supabase
├── public/                     # Assets estáticos (PWA manifest, sw.js, íconos)
├── android/                    # Proyecto Android generado por Capacitor
├── out/                        # Output del export estático (no commitear)
└── capacitor.config.ts         # Config Capacitor (App ID: com.sosecure.app)
```

---

## Estado Global (`lib/store.ts`)

Usa **Zustand** con `persist` en localStorage. Acceder siempre con el hook:

```ts
const { contacts, currentLocation, sosActive, ... } = useAppStore()
```

**Campos persistidos:** `contacts`, `mapCenter`, `mapZoom`, `frequentPlaces`, `locationHistory`, `offlineQueue`, `isLiveSharing`, `voiceKeyword`, `simpleMode`

**Campos en memoria:** `activeTab`, `currentLocation`, `sosActive`, `nearbyIncidents`, `routeOptions`

---

## Tipos de Dominio Clave (`lib/types.ts`)

```ts
TabId            // 'home' | 'before' | 'during' | 'after' | 'medic'
IncidentType     // 'theft-assault-violence' | 'harassment-suspicious' | 'accident' | 'SOS'
IncidentSeverity // 'high' | 'medium' | 'low'
Incident         // Incidente con ubicación, tipo, severidad y votos
EmergencyContact // Contacto con nivel de prioridad (primary/secondary/tertiary)
SOSAlert         // Alerta SOS activa con ubicación y contactos notificados
TrackingSession  // Sesión de rastreo compartido
SafeZone         // Zona segura (policía, hospital, farmacia, tienda)
FrequentPlace    // Lugar favorito guardado
```

---

## Flujo Principal de la Aplicación

1. **Auth:** Supabase Auth (email/contraseña). Callback en `/auth/callback`.
2. **Splash + Permisos:** `app/page.tsx` verifica sesión y redirige. `permission-gate.tsx` solicita GPS, cámara, notificaciones.
3. **Shell:** `app-shell.tsx` renderiza la barra inferior + tab activo + botón SOS flotante.
4. **Activación SOS:**
   - Hold 1 segundo en botón SOS
   - Presionar volumen 5 veces en 3 segundos
   - Palabra clave de voz (configurable)
   - Graba video/audio desde cámara trasera
   - Transmite ubicación a Supabase Realtime
   - Envía emails a contactos vía Resend
5. **Mapa comunitario:** Incidentes en tiempo real con heatmap Leaflet.
6. **Rutas seguras:** OSRM calcula la ruta, se puntúa según incidentes cercanos.
7. **Apoyo IA:** `medic-tab.tsx` → `api/chat/route.ts` → Claude API (claude-haiku).

---

## Convenciones de Código

### TypeScript
- Strict mode habilitado (`tsconfig.json`)
- Path alias: `@/*` apunta a la raíz del proyecto
- Tipos del dominio siempre en `lib/types.ts`
- Nunca usar `any`; preferir tipos específicos o `unknown`

### Componentes React
- Componentes funcionales con TypeScript siempre
- Props tipadas con `interface`, no `type` para objetos complejos
- Un componente por archivo
- Nombrar archivos en kebab-case: `mi-componente.tsx`

### Estilos
- **Tailwind CSS** para todo. No CSS modules ni styled-components
- Función `cn()` de `lib/utils.ts` para combinar clases condicionalmente
- Variables de color personalizadas: `primary` (cyan), `destructive` (rojo), `warning` (amarillo), `safe` (verde)
- Dark mode via clase CSS (`.dark`)
- Componentes UI base en `components/ui/` son de shadcn/ui — **no editar directamente**

### API Routes (Next.js)
- Archivos en `app/api/*/route.ts`
- Usar `supabase/server.ts` para operaciones con privilegios
- Usar `supabase/client.ts` desde componentes cliente
- Validar siempre la sesión en rutas protegidas
- **Usar admin client (service role) para cualquier INSERT/UPDATE en tablas con RLS** — el cliente de servidor con sesión de usuario puede ser bloqueado por RLS silenciosamente

### Commits
- En **español**
- Formato: `tipo: descripción breve`
- Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`

---

## Supabase

### Tablas Principales
- `profiles` — Datos de usuario (extiende `auth.users`)
- `emergency_contacts` — Contactos de emergencia por usuario
- `sos_alerts` — Alertas SOS activas/históricas
- `sos_locations` — Ubicaciones en tiempo real durante SOS
- `incidents` — Incidentes reportados con coordenadas y votos
- `recordings` — Grabaciones almacenadas con límite de tamaño
- `family_groups` — Grupos del plan familiar (un registro por dueño)
- `family_members` — Miembros del grupo familiar con estado e invite_token
- `premium_subscriptions` — Suscripciones individuales al plan premium

### Clientes Supabase
```ts
// Cliente (browser/componentes)
import { createClient } from '@/lib/supabase/client'

// Servidor (API routes, Server Components)
import { createClient } from '@/lib/supabase/server'

// Admin / service role (bypasea RLS — usar en API routes que escriben tablas con RLS)
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
```

### Realtime
- `sos_locations` usa Supabase Realtime para transmisión de ubicación en vivo
- Los suscriptores ven la ruta en `/emergency/[alertId]`

---

## Integración Claude AI

- SDK: `@anthropic-ai/sdk`
- Rutas: `app/api/chat/route.ts` y `app/api/emergency-chat/route.ts`
- Modelo actual: `claude-haiku` (para menor latencia en emergencias)
- Clave API: `NEXT_PUBLIC_ANTHROPIC_API_KEY` (prefijo `NEXT_PUBLIC_` porque se usa en cliente también)
- Uso principal: apoyo psicológico en `medic-tab.tsx` y asistencia en emergencias

---

## Capacitor / Android

- **App ID:** `com.sosecure.app`
- **Web dir:** `out` (requiere `npm run export` antes de sincronizar)
- **Server URL (producción):** `https://sosecure-ten.vercel.app`
- **Esquema Android:** `https`
- Permisos Android requeridos: `ACCESS_FINE_LOCATION`, `CAMERA`, `RECORD_AUDIO`, `VIBRATE`, `POST_NOTIFICATIONS`

**Flujo para generar APK:**
```bash
npm run export
npm run cap:sync
npm run cap:android  # Luego Build > Generate Signed APK en Android Studio
```

---

## PWA

- Manifest en `public/manifest.json`
- Service Worker en `public/sw.js` (soporte offline)
- Íconos: `public/icon-192.png`, `public/icon-512.png`, `public/apple-icon.png`
- `next.config.ts` tiene `output: 'export'` y `unoptimized: true` para imágenes

---

## Despliegue

- **Producción:** Vercel (`https://sosecure-ten.vercel.app`)
- **Branch principal:** `main`
- El export estático (`/out`) es el que empaqueta Capacitor para Android

---

## Cosas a Tener en Cuenta

- El proyecto **no usa** Redux, Context API ni React Query — solo Zustand
- Los componentes en `components/ui/` son auto-generados por shadcn/ui; agregar nuevos con `npx shadcn@latest add <componente>`
- La carpeta `out/` y `.next/` **no se commitean**
- El `capacitor.config.ts` apunta a la URL de producción; en desarrollo local ajustar si se prueba en dispositivo físico
- Las Edge Functions de Supabase (`notify-contacts`, `notify-nearby-users`) viven en `supabase/functions/`
- El PIN de seguridad se hashea en `lib/pin.ts` antes de guardarse
- Las grabaciones se suben a Supabase Storage con límite de tamaño definido en `lib/recordings.ts`

---

## Arquitectura — Decisiones Importantes

### Geolocalización centralizada
- **Un solo watcher GPS** vive en `app-shell.tsx` (`useGeolocation({ watch: true })`).
- El resultado se guarda en el store (`currentLocation`, `locationLoading`, `locationError`).
- Todos los tabs y componentes consumen `currentLocation` del store — **no llaman `useGeolocation` directamente**.
- El `VolumeButtonPlugin` existe solo como `.java` (`android/app/src/main/java/com/sosecure/app/VolumeButtonPlugin.java`). **No crear versión `.kt`** — causaría redeclaración en tiempo de compilación.

### Stream de cámara/mic durante SOS
- Cuando el SOS se activa, `sos-button.tsx` obtiene el `MediaStream` de cámara/mic y lo guarda en `sosStream` del store (no persistido).
- `during-tab.tsx` reutiliza ese stream en vez de llamar `getUserMedia` (que falla en Android con la cámara ocupada).
- Al cancelar el SOS, `sosStream` se limpia con `setSosStream(null)`.

### Reconocimiento de voz — sincronización con SOS
- `app-shell.tsx` usa `voicePausedRef` (ref síncrona) para pausar/reanudar el reconocimiento de voz al activar/cancelar el SOS.
- **No usar `sosActiveRef`** para esta lógica — tiene condición de carrera con el ciclo de renders de React.

### `sos_locations` — actualización de ubicación
- El insert inicial al activar SOS crea el registro.
- Las actualizaciones periódicas (cada 1 s) usan `.update().eq('alert_id', ...)` — **no `.upsert()`**, porque `alert_id` no tiene restricción `UNIQUE` en la tabla.

### Desarrollo en dispositivo Android
- `npm run android:dev` usa `--host=localhost` con `--forwardPorts=3000:3000` (ADB port forward).
- **No usar la IP de la PC** como host — HTTP sobre IP no es "secure context" y `navigator.mediaDevices` queda `undefined`.
- `navigator.mediaDevices` requiere HTTPS o `localhost`; en la APK de producción funciona por el esquema `https://` de Capacitor.

### Notificaciones SOS no abren WhatsApp
- Los contactos se notifican **solo por correo** (Resend + Edge Function `notify-contacts`).
- Los fallbacks a WhatsApp fueron eliminados de `lib/recordings.ts` y `components/emergency-chat.tsx`.

### Modo Simple (accesibilidad)
- Un solo campo `simpleMode: boolean` en el store (persistido). Toggle en el dialog de Ajustes (`app-shell.tsx`).
- **No se duplican componentes** — renderizado condicional con `{!simpleMode && ...}` en cada tab.
- Efectos por tab: `home-tab` oculta tips, coordenadas GPS, badge de prioridad y campos email/relationship; `before-tab` oculta rutas, tracking en vivo y palabra clave de voz, simplifica preset de temporizador a 3 opciones; `during-tab` oculta preguntas de incidente, métodos secretos e historial de ubicación; `after-tab` oculta historial SOS, grabaciones y zonas de peligro; `routes-tab` muestra solo la ruta más segura con emoji en lugar de score numérico; `medic-tab` agranda textarea y botones rápidos.
- `bottom-navigation.tsx` agranda íconos y barra (`h-20` vs `h-16`) en simpleMode.
- `sos-button.tsx` agranda el botón a `w-28 h-28` (vs `w-20 h-20`) y ajusta SVG circle `cx/cy/r` y posición `bottom-24` (vs `bottom-20`) para la barra más alta.
- `app-shell.tsx` muestra banner amarillo cuando está activo y agrega clase `text-lg` al `<main>` para escalar tipografía base.

### Plan Familiar y Plan Premium — Pagos

- Pasarelas activas: **Mercado Pago** (preferida) y **PayPal** (respaldo). El usuario elige en la página de pago.
- Flujo general: `FamilyPlanSection` / `PremiumPlanSection` → página de pago → `/api/family/checkout` o `/api/premium/checkout` → proveedor → captura al regresar → webhook como respaldo

**Mercado Pago — suscripciones recurrentes (`preapproval_plan`):**
- Los planes se crean vía API (`POST /preapproval_plan`) con `auto_recurring` y `back_url` — **NO desde el dashboard web** (los planes del dashboard requieren `card_token_id` y no permiten redirect).
- El checkout obtiene el `init_point` del plan (`GET /preapproval_plan/{id}`) y redirige al usuario.
- Al regresar, MP añade `?preapproval_id=xxx` a la `back_url`. La página lo captura y llama `action: 'capture-mercadopago'`.
- El webhook mapea por `payer_email` si no hay `external_reference` (flujo de plan compartido).
- Variables requeridas: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PREMIUM_PLAN_ID`, `MERCADOPAGO_FAMILY_PLAN_ID`

**PayPal — suscripciones recurrentes (`Subscriptions API`):**
- Requiere Billing Plans creados en el panel de PayPal (sandbox: sandbox.paypal.com, live: business dashboard).
- El checkout crea una suscripción con `POST /v1/billing/subscriptions` y redirige al `approve` link.
- Al regresar con `?subscription_id=xxx`, se verifica con `GET /v1/billing/subscriptions/{id}`.
- Variables requeridas: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_FAMILY_PLAN_ID`, `PAYPAL_PREMIUM_PLAN_ID`

**Webhooks (respaldo si el usuario cierra antes de regresar):**
- MP (family y premium): `https://sosecure.site/api/family/webhook` — eventos `subscription_preapproval` y `payment`
- PayPal (family): `https://sosecure.site/api/family/webhook` — `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED`
- PayPal (premium): `https://sosecure.site/api/premium/webhook` — `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED`
- Verificación de firma habilitada cuando `MERCADOPAGO_WEBHOOK_SECRET` y `PAYPAL_WEBHOOK_ID_*` están configurados

**Cancelación:**
- Desde Ajustes → botón "Cancelar suscripción" → `POST /api/family/cancel` o `/api/premium/cancel`
- Cancela en MP (`PATCH /preapproval/{id}`) o PayPal (`POST /subscriptions/{id}/cancel`) y actualiza Supabase

**Reglas de negocio:**
- Todos los writes a `family_groups`, `family_members` y `premium_subscriptions` usan **admin client** para evitar bloqueo RLS
- `FamilyPlanSection` usa `getOwnedGroup` (no `ensureOwnedGroup`) para reflejar el status actualizado
- La gestión de miembros (invitar/quitar) solo se muestra al **dueño** (`group?.status === 'active'`), no a miembros invitados
- Los miembros invitados ven su estado con `getMemberGroup()` de `lib/family.ts`
- Si el usuario tiene plan familiar activo (dueño o miembro), `PremiumPlanSection` muestra "Incluido en tu Plan Familiar" en lugar del botón de compra — incluso si tienen premium individual

### RLS en `family_groups` y `family_members`

Políticas activas necesarias (aplicar en Supabase → SQL Editor si no existen):

```sql
-- family_groups: solo el dueño puede leer/escribir su grupo
-- Los miembros leen su grupo via función SECURITY DEFINER para evitar recursión infinita
CREATE OR REPLACE FUNCTION get_user_group_ids(uid uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT group_id FROM family_members WHERE user_id = uid AND status = 'active'
$$;

CREATE POLICY "member can read group" ON family_groups FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_group_ids(auth.uid())) OR owner_id = auth.uid());
```

**NO crear política** `member can read` que haga subquery a `family_groups` desde `family_members` — causa recursión infinita (`42P17`).

### Internacionalización (i18n)
- Sistema propio en `lib/i18n.ts`: objeto plano `es` como fuente de verdad, más `en`, `nah` (Náhuatl), `myn` (Maya Yucateco), `tze` (Tseltal).
- **Lenguas indígenas usan `...es` como base** — cualquier clave sin override explícito muestra el español. Al agregar una clave nueva a `es`, también agregarla a `en` (TypeScript lo exige: `en: typeof es`) y añadir overrides en los bloques `nah`, `myn`, `tze`.
- Hook de acceso: `const { t } = useTranslation()` — lee `language` del store Zustand y devuelve `t(key: string): string`.
- El idioma se persiste en `language: Lang` dentro del store (localStorage). Selector en Ajustes (`app-shell.tsx`) usa `<Select>` de shadcn/ui.
- **Nunca llamar `t()` a nivel de módulo** — los arrays/objetos con strings traducidos deben definirse dentro del componente (o factory), no en el scope del archivo. De lo contrario quedan congelados en español.
- **Strings que NO se traducen** (van siempre en código): `incident_type` en la BD (`'theft-assault-violence'`, etc.), respuestas del cuestionario (`'si'`/`'no'`/`'no_se'`), `severity` (`'high'`/`'medium'`/`'low'`). Solo la UI los traduce para mostrar.
- Reemplazos dinámicos: patrón `.replace('{key}', value)` — la clave `{key}` se define igual en todos los idiomas.
- **Hidratación en páginas auth**: páginas con `useSearchParams` necesitan `if (!mounted) return null` para evitar mismatch entre el render del servidor (español) y el cliente (idioma guardado).
