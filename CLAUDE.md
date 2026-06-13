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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ANTHROPIC_API_KEY=
RESEND_API_KEY=
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

### Clientes Supabase
```ts
// Cliente (browser/componentes)
import { createClient } from '@/lib/supabase/client'

// Servidor (API routes, Server Components)
import { createClient } from '@/lib/supabase/server'
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
- `simpleMode: boolean` en el store Zustand, **persistido** en localStorage.
- Se activa con un toggle en el dialog de Ajustes (`app-shell.tsx`).
- Todos los tabs leen `simpleMode` del store y adaptan su UI mediante renderizado condicional — **no se duplican componentes**.
- Efectos en cada tab:
  - **`bottom-navigation.tsx`**: íconos `w-7 h-7`, texto `text-xs font-semibold`, barra `h-20`
  - **`home-tab.tsx`**: oculta tips de seguridad, coordenadas GPS (muestra "Ubicación activa ✓"), badge de prioridad, campos email/relationship/importancia en formularios de contacto
  - **`before-tab.tsx`**: oculta sección de rutas, mapa, tracking en vivo y palabra clave de voz; temporizador solo muestra botones 15/30/60 min
  - **`during-tab.tsx`**: oculta preguntas yes/no/unsure del incidente, sección de activación secreta e historial de ubicación; post-grabación muestra solo "Enviar a contactos"; countdown de video con texto más grande
  - **`after-tab.tsx`**: oculta historial SOS, grabaciones y zonas de peligro; botón "Llegué bien" con `h-14`
  - **`routes-tab.tsx`**: oculta tips de seguridad, muestra solo la ruta más segura (índice 0), reemplaza score numérico con emoji ✅/⚠️/❌, oculta conteo de incidentes
  - **`medic-tab.tsx`**: botones de acceso rápido más grandes, textarea `min-h-[80px]`
  - **`app-shell.tsx`**: `<main>` con clase `text-lg` cuando activo; banner amarillo bajo el header
