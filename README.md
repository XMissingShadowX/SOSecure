# SOSecure — Aplicación de Seguridad Personal

> SOS de Emergencia · Mapa Comunitario · Rutas Seguras · Apoyo Psicológico con IA · Planes Free y Premium

---

## Funcionalidades

### Alertas SOS
| Funcionalidad | Descripción |
|---|---|
| 🆘 SOS con Pulsación Prolongada | Mantén 1 segundo el botón → graba video/audio, envía ubicación GPS a Supabase y notifica a contactos por correo (Resend) |
| 🔊 Activación por Volumen | Presiona subir/bajar volumen 5 veces en 3 segundos para activar SOS sin tocar la pantalla |
| 🗣️ Activación por Voz | Palabra clave personalizable que activa SOS automáticamente mediante reconocimiento de voz continuo |
| 👆 Toque Secreto | 3 taps rápidos en botón oculto activan SOS de forma discreta |
| ⏱️ Temporizador Automático | Si el temporizador de seguridad expira sin confirmación de llegada, SOS se activa solo |

### Grabación de Evidencia
| Funcionalidad | Descripción |
|---|---|
| 📹 Video SOS | Graba desde cámara trasera al activar SOS; **free: máx 30 s con countdown**, premium: ilimitado |
| 🎙️ Audio SOS | Grabación de audio ilimitada para todos los planes |
| ☁️ Subida a Supabase | Guarda grabaciones en Supabase Storage vinculadas a la alerta SOS |
| 💾 Descarga Local | Guarda grabaciones directamente en el dispositivo |
| 📤 Envío a Contactos | Comparte la grabación con contactos de emergencia vía chat interno o sistema de compartir |

### Mapa y Rutas
| Funcionalidad | Descripción |
|---|---|
| 🗺️ Mapa Comunitario | Mapa Leaflet en tiempo real con marcadores por severidad (rojo/ámbar/azul) y filtro por tipo |
| 🔥 Mapa de Calor | Toggle entre marcadores y heatmap (leaflet.heat) con degradado según densidad |
| 🛣️ Rutas Seguras | Hasta 3 rutas alternativas con OSRM + puntuación de seguridad según incidentes cercanos |
| 🔒 Límite de Rutas (Free) | 1 búsqueda por día; rutas 2 y 3 se muestran bloqueadas con overlay de candado |
| 📍 Lugares Frecuentes | Guarda lugares con geocodificación (casa, trabajo, etc.) para selección rápida en rutas |
| 🔍 Origen Personalizable | Cambia el punto de inicio de la ruta a cualquier dirección, no solo tu ubicación actual |

### Seguridad Comunitaria
| Funcionalidad | Descripción |
|---|---|
| 📋 Reporte Inteligente | Preguntas contextuales por tipo de incidente (robo, acoso, accidente) que calculan la severidad automáticamente |
| 🗳️ Votos de Verificación | Usuarios votan si un incidente es real o falso; los que acumulan votos falsos se desactivan |
| 🔔 Notificación a Cercanos | Edge Function `notify-nearby-users` alerta a usuarios próximos al reportar un incidente (todos los planes) |
| ⚠️ Alertas de Zona | Notificación automática cuando hay zonas de alto peligro cerca de tu ubicación |

### Tracking y Contactos
| Funcionalidad | Descripción |
|---|---|
| 📡 Seguimiento SOS en Vivo | Página pública `/emergency/[alertId]` con ubicación en tiempo real durante alerta activa |
| 👥 Ubicaciones en Vivo (Premium) | Comparte tu ubicación con contactos SOSecure en tiempo real, estilo Life360 |
| 📧 Notificación por Correo | Correo automático a contactos con coordenadas GPS y enlace de seguimiento |
| ✅ "Llegué Bien" | Notifica a tus contactos que llegaste a salvo vía chat interno o WhatsApp |
| 👤 Gestión de Contactos | **Free: máx 2 contactos**, Premium: máx 10, con niveles de importancia (principal/secundario/terciario) |
| 🔐 PIN de Seguridad | PIN opcional que protege el acceso a la app, con hash seguro antes de guardarse |

### Apoyo y Bienestar
| Funcionalidad | Descripción |
|---|---|
| 🤖 Chat de Apoyo Psicológico (Premium) | Asistente con IA (Claude Haiku) con técnicas de manejo de ansiedad, respiración y crisis emocionales |
| 💬 Respuestas Offline | Técnicas predefinidas (5-4-3-2-1, respiración cuadrada) disponibles sin conexión |
| 🆘 Recursos de Crisis | Links directos a SAPTEL (55 5259-8121) y CONASAMA (800 290-0024) siempre visibles |

### Planes y Pagos
| Funcionalidad | Descripción |
|---|---|
| 🆓 Plan Free | SOS ilimitado, audio ilimitado, 2 contactos, 1 ruta/día, mapa comunitario |
| ⭐ Plan Premium ($59/mes) | Todo Free + chat IA, video ilimitado, 10 contactos, rutas ilimitadas, tracking compartido, historial SOS |
| 👨‍👩‍👧 Plan Familiar ($499/año) | Hasta 5 miembros con acceso Premium completo |
| 📜 Historial de Alertas SOS (Premium) | Revisa alertas pasadas con filtros de 1 semana / 1 / 3 / 6 meses |

### Accesibilidad
| Funcionalidad | Descripción |
|---|---|
| 🧩 Modo Simple | Toggle en Ajustes que simplifica la UI para adultos mayores y niños: íconos y texto más grandes, navegación con barra más alta, oculta secciones avanzadas (rutas en antes-tab, historial, activación secreta, preguntas de incidente), muestra solo la acción principal en cada tab |

### General
| Funcionalidad | Descripción |
|---|---|
| 🔑 Recuperación de Contraseña | Flujo completo de reset de contraseña por correo vía Supabase Auth |
| 🌙 Tema Claro / Oscuro | Soporte completo con detección automática y cambio manual |
| 📶 Modo Offline | Reportes en cola local, sincronización automática al recuperar conexión |
| 🔔 Notificaciones Push | Notificaciones nativas en navegador y Android |
| 🛡️ Panel de Administración | Gestión de usuarios e incidentes en `/admin` (solo admins) |

---

## Planes Free vs Premium

| Feature | Free | Premium / Familiar |
|---------|:----:|:-----------------:|
| Botón SOS (hold, volumen, voz) | ✅ | ✅ |
| Notificación email a contactos | ✅ | ✅ |
| Transmisión de ubicación SOS | ✅ | ✅ |
| Grabación de audio | ✅ ilimitado | ✅ ilimitado |
| Grabación de video | ✅ máx 30 s | ✅ ilimitado |
| Contactos de emergencia | ✅ máx 2 | ✅ máx 10 |
| Mapa comunitario | ✅ | ✅ |
| Rutas seguras | ✅ 1/día, 1 ruta | ✅ ilimitado, 3 rutas |
| Rutas alternativas (2 extra) | 🔒 bloqueadas | ✅ |
| Temporizador de seguridad | ✅ | ✅ |
| Tracking compartido en vivo | ❌ oculto | ✅ |
| Chat IA de bienestar | 🔒 | ✅ ilimitado |
| Historial de alertas SOS | 🔒 | ✅ con filtros |
| Mis grabaciones (after-tab) | ✅ | ✅ |
| notify-nearby-users | ✅ | ✅ |
| Plan Familiar | ❌ | ✅ hasta 5 miembros |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, static export) |
| UI | React 19 + Tailwind CSS 3 + shadcn/ui (Radix UI) |
| Estado global | Zustand 5 con persistencia en localStorage |
| Backend / Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| IA | Anthropic Claude API — modelo `claude-haiku-4-5` |
| Mapas | Leaflet + react-leaflet + leaflet.heat |
| Rutas | OSRM (Open Source Routing Machine) |
| Geocodificación | Photon / Komoot |
| Mobile | Capacitor 8 (Android) |
| Email | Resend API |
| Gráficas | recharts |
| Iconos | lucide-react |
| Fechas | date-fns |

---

## Variables de Entorno

Crea un archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
NEXT_PUBLIC_ANTHROPIC_API_KEY=tu-clave-anthropic
RESEND_API_KEY=tu-clave-resend
```

> **Nunca** commitear `.env.local`. Ya está en `.gitignore`.

---

## Esquema de Supabase

Ejecuta los scripts en `supabase/migrations/` en orden. A continuación el esquema completo:

```sql
-- Extensiones
create extension if not exists pgcrypto;

-- Perfiles de usuario
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       text default 'user',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "usuarios leen su perfil" on profiles for select using (auth.uid() = id);
create policy "usuarios actualizan su perfil" on profiles for update using (auth.uid() = id);

-- Contactos de emergencia
create table emergency_contacts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  phone        text        not null,
  email        text,
  relationship text,
  priority     int         default 1,
  importance   text        not null default 'secondary'
                           check (importance in ('primary','secondary','tertiary')),
  created_at   timestamptz default now()
);
alter table emergency_contacts enable row level security;
create policy "usuarios gestionan sus contactos" on emergency_contacts
  for all using (auth.uid() = user_id);

-- Alertas SOS
create table sos_alerts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users(id) on delete cascade,
  latitude          float8      not null,
  longitude         float8      not null,
  status            text        default 'active',
  contacts_notified text[],
  video_url         text,
  created_at        timestamptz default now(),
  resolved_at       timestamptz
);
alter table sos_alerts enable row level security;
create policy "usuarios gestionan sus alertas" on sos_alerts
  for all using (auth.uid() = user_id);
create policy "lectura pública de alertas activas" on sos_alerts
  for select using (status = 'active');

-- Ubicaciones SOS en tiempo real
create table sos_locations (
  alert_id   uuid        references sos_alerts(id) on delete cascade,
  user_id    uuid        references auth.users(id) on delete cascade,
  latitude   float8      not null,
  longitude  float8      not null,
  updated_at timestamptz default now(),
  primary key (alert_id)
);
alter table sos_locations enable row level security;
create policy "lectura pública de ubicaciones" on sos_locations for select using (true);
create policy "usuario inserta/actualiza su ubicación" on sos_locations
  for all using (auth.uid() = user_id);

-- Incidentes comunitarios
create table incidents (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users(id) on delete set null,
  title             text        not null,
  description       text,
  incident_type     text        not null,
  severity          text        not null,
  latitude          float8      not null,
  longitude         float8      not null,
  is_active         boolean     default true,
  is_verified       boolean     default false,
  votes_real        int         default 0,
  votes_fake        int         default 0,
  false_alarm_count int         default 0,
  reported_at       timestamptz default now(),
  resolved_at       timestamptz
);
alter table incidents enable row level security;
create policy "lectura pública de incidentes activos" on incidents
  for select using (is_active = true);
create policy "usuarios autenticados insertan" on incidents
  for insert with check (auth.uid() is not null);
create policy "usuarios actualizan los suyos" on incidents
  for update using (auth.uid() = user_id);

-- Grabaciones de video/audio
create table recordings (
  id              uuid             primary key default gen_random_uuid(),
  user_id         uuid             not null references auth.users(id) on delete cascade,
  storage_path    text             not null,
  public_url      text,
  recording_type  text             not null check (recording_type in ('audio', 'video')),
  mime_type       text             not null,
  duration_ms     integer          not null default 0,
  file_size_bytes bigint           not null default 0,
  latitude        double precision,
  longitude       double precision,
  sos_alert_id    uuid             references sos_alerts(id) on delete set null,
  created_at      timestamptz      not null default now()
);
alter table recordings enable row level security;
create policy "select_own" on recordings for select using (auth.uid() = user_id);
create policy "insert_own" on recordings for insert with check (auth.uid() = user_id);
create policy "delete_own" on recordings for delete using (auth.uid() = user_id);

-- Ubicaciones en vivo (tracking Life360)
create table user_locations (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  latitude   float8,
  longitude  float8,
  updated_at timestamptz default now()
);
alter table user_locations enable row level security;
create policy "usuarios leen ubicaciones de sus contactos" on user_locations
  for select using (true);
create policy "usuario actualiza su ubicación" on user_locations
  for all using (auth.uid() = user_id);

-- Sesiones de tracking compartido
create table tracking_sessions (
  id             uuid primary key default gen_random_uuid(),
  initiator_id   uuid references auth.users(id) on delete cascade,
  timer_end      timestamptz,
  created_at     timestamptz default now()
);
create table tracking_members (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references tracking_sessions(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  display_name   text,
  is_initiator   boolean default false,
  external_token text,
  is_sharing     boolean default false,
  latitude       float8,
  longitude      float8,
  updated_at     timestamptz default now()
);

-- Búsquedas de rutas (límite free: 1/día)
create table route_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  searched_at timestamptz default now() not null
);
alter table route_searches enable row level security;
create policy "users own searches" on route_searches
  for all using (auth.uid() = user_id);

-- Chat interno entre usuarios SOSecure
create table chat_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  content     text not null,
  type        text default 'text',
  created_at  timestamptz default now()
);
create table chat_conversations (
  user_a           uuid,
  user_b           uuid,
  last_message     text,
  last_message_at  timestamptz,
  primary key (user_a, user_b)
);

-- Plan Familiar
create table family_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  name       text,
  created_at timestamptz default now()
);
create table family_members (
  group_id   uuid references family_groups(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text default 'member',
  joined_at  timestamptz default now(),
  primary key (group_id, user_id)
);

-- Suscripciones Premium
create table premium_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  status     text default 'active',
  plan_id    text,
  created_at timestamptz default now(),
  expires_at timestamptz
);
```

### RPCs necesarias

```sql
-- Votos de incidentes
create or replace function increment_votes(incident_id uuid, vote_column text)
returns void language plpgsql security definer as $$
begin
  if vote_column = 'votes_real' then
    update incidents set votes_real = votes_real + 1 where id = incident_id;
  elsif vote_column = 'votes_fake' then
    update incidents set votes_fake = votes_fake + 1,
      false_alarm_count = false_alarm_count + 1 where id = incident_id;
  end if;
end;
$$;

-- Buscar usuario por email (para chat interno y grabaciones)
create or replace function get_user_id_by_email(p_email text)
returns uuid language sql security definer as $$
  select id from auth.users where email = p_email limit 1;
$$;

-- Verificar acceso premium (premium_subscriptions activo O miembro de family_groups)
create or replace function has_premium_access()
returns boolean language sql security definer as $$
  select exists (
    select 1 from premium_subscriptions
    where user_id = auth.uid() and status = 'active'
      and (expires_at is null or expires_at > now())
  ) or exists (
    select 1 from family_members fm
    join family_groups fg on fg.id = fm.group_id
    where fm.user_id = auth.uid()
  );
$$;

-- Contar búsquedas de rutas del día (zona horaria México)
create or replace function count_route_searches_today(p_user_id uuid)
returns int language sql security definer as $$
  select count(*)::int from route_searches
  where user_id = p_user_id
    and searched_at >= date_trunc('day', now() at time zone 'America/Mexico_City');
$$;

-- Registrar una búsqueda de ruta
create or replace function insert_route_search(p_user_id uuid)
returns void language sql security definer as $$
  insert into route_searches (user_id) values (p_user_id);
$$;
```

### Storage

```sql
-- Bucket de grabaciones (50 MB máx por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 52428800,
  array['audio/webm','audio/ogg','audio/mp4','video/webm','video/mp4'])
on conflict (id) do nothing;

create policy "upload_own" on storage.objects for insert
  with check (bucket_id = 'recordings' and auth.uid()::text = (string_to_array(name, '/'))[1]);
create policy "read_own" on storage.objects for select
  using (bucket_id = 'recordings' and auth.uid()::text = (string_to_array(name, '/'))[1]);
```

---

## Edge Functions de Supabase

| Función | Descripción |
|---|---|
| `notify-contacts` | Envía correo (Resend) a contactos de emergencia con nombre, coordenadas GPS y enlace de seguimiento al activar SOS |
| `notify-nearby-users` | Notifica a usuarios cercanos cuando se reporta un incidente en su zona (activo para todos los planes) |

---

## Comandos Esenciales

```bash
# Desarrollo
npm run dev           # Puerto 3000
npm run dev:3001      # Puerto 3001

# Producción
npm run build         # Compilar Next.js
npm run export        # Build + export estático → /out
npm run start         # Servidor de producción

# Android / Capacitor
npm run cap:sync      # Sincronizar build con Capacitor
npm run cap:android   # Abrir Android Studio

# Linting
npm run lint
```

---

## Compilación del APK (Android)

### Requisitos
- Node.js 18+
- Java JDK 17+
- Android Studio con SDK 34+

### Pasos

```bash
# 1. Exportar build estático
npm run export

# 2. Sincronizar con Capacitor
npm run cap:sync

# 3. Abrir Android Studio
npm run cap:android
# → Build > Generate Signed APK
```

### Comando rápido (debug)
```bash
npm run export && npx cap sync android && cd android && ./gradlew assembleDebug
```

---

## Permisos de Android

| Permiso | Uso |
|---|---|
| `ACCESS_FINE_LOCATION` | Rastreo GPS en tiempo real |
| `ACCESS_COARSE_LOCATION` | Ubicación por red |
| `CAMERA` | Grabación de video al activar SOS |
| `RECORD_AUDIO` | Grabación de audio al activar SOS |
| `VIBRATE` | Vibración háptica al activar SOS |
| `POST_NOTIFICATIONS` | Notificaciones push |
| `RECEIVE_BOOT_COMPLETED` | Servicios en segundo plano |

---

## Estructura del Proyecto

```
SOSecure/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Splash screen + verificación de auth
│   ├── layout.tsx                # Layout raíz + metadata PWA
│   ├── globals.css               # Variables CSS globales + estilos Leaflet
│   ├── admin/                    # Panel de administración (solo admins)
│   ├── auth/                     # Login, sign-up, callback, recuperar contraseña
│   ├── emergency/[alertId]/      # Página pública de alerta SOS activa
│   ├── tracking/[sessionId]/     # Sesión de rastreo compartido
│   ├── plan-familiar/            # Pago y aceptación del plan familiar
│   ├── plan-premium/             # Pago del plan premium
│   ├── privacidad/               # Política de privacidad
│   ├── terminos/                 # Términos y condiciones
│   └── api/
│       ├── chat/                 # Chat IA con Claude (apoyo psicológico)
│       ├── emergency-chat/       # Chat de emergencias
│       ├── delete-account/       # Borrar cuenta
│       ├── pin/                  # Gestión de PIN de seguridad
│       ├── tracking-location/    # Ubicación en tiempo real
│       ├── tracking-invite/      # Invitaciones de tracking
│       └── family/               # Plan familiar (invites, pagos, webhook)
│
├── components/
│   ├── tabs/
│   │   ├── home-tab.tsx          # Ubicación, contactos (2 free/10 premium), lugares frecuentes
│   │   ├── before-tab.tsx        # Rutas, temporizador, zonas seguras, tracking (solo premium)
│   │   ├── during-tab.tsx        # Grabación (video 30s free/ilimitado premium), reporte de incidentes
│   │   ├── after-tab.tsx         # Llegué bien, grabaciones, historial SOS (premium), alertas de zona
│   │   ├── medic-tab.tsx         # Chat IA de bienestar (solo premium)
│   │   ├── map-tab.tsx           # Mapa comunitario de incidentes
│   │   └── routes-tab.tsx        # Rutas con OSRM (1/día free, ilimitado premium)
│   ├── app-shell.tsx             # Wrapper: tabs + botón SOS + configuración + PIN
│   ├── sos-button.tsx            # Botón SOS (hold/volumen/voz/toque secreto)
│   ├── upgrade-banner.tsx        # Banner de upgrade Free→Premium (compacto e inline)
│   ├── incident-map.tsx          # Mapa Leaflet con marcadores y heatmap
│   ├── emergency-chat.tsx        # Chat de emergencias en tiempo real
│   ├── route-map.tsx             # Mapa con rutas OSRM
│   ├── family-plan-section.tsx   # UI del plan familiar
│   ├── pin-lock.tsx              # Pantalla de PIN de seguridad
│   ├── permission-gate.tsx       # Solicitud de permisos del dispositivo
│   ├── bottom-navigation.tsx     # Barra de navegación inferior
│   ├── error-boundary.tsx        # Manejo de errores React
│   ├── theme-provider.tsx        # Tema claro/oscuro
│   └── ui/                       # Componentes shadcn/ui (no editar directamente)
│
├── hooks/
│   ├── use-premium.ts            # RPC has_premium_access → { isPremium, loading }
│   ├── use-geolocation.ts        # GPS con modo watch
│   ├── use-volume-sos.ts         # Activación SOS con botones de volumen
│   ├── use-tracking.ts           # Sesión de rastreo compartido
│   ├── use-incoming-tracking.ts  # Recibir ubicación de otros
│   ├── use-live-location.ts      # Transmitir ubicación en tiempo real (Life360)
│   ├── use-contact-user-ids.ts   # Mapear contactos a IDs de Supabase
│   └── use-permissions.ts        # Solicitar permisos del dispositivo
│
├── lib/
│   ├── store.ts                  # Estado global Zustand (persistido en localStorage)
│   ├── types.ts                  # Interfaces TypeScript del dominio
│   ├── utils.ts                  # Utilidades (cn())
│   ├── plan-config.ts            # Configuración de planes Free/Premium/Familiar
│   ├── notifications.ts          # Notificaciones push y alarmas
│   ├── recordings.ts             # Grabación de audio/video
│   ├── pin.ts                    # Hash y validación de PIN
│   ├── family.ts                 # Lógica del plan familiar
│   ├── live-stream.ts            # Transmisión de ubicación en vivo
│   ├── incident-reminder.ts      # Recordatorios de incidentes
│   └── supabase/
│       ├── client.ts             # Cliente Supabase (browser)
│       └── server.ts             # Cliente Supabase (server-side)
│
├── supabase/
│   └── migrations/               # Scripts SQL numerados (aplicar en orden)
│
├── public/                       # Assets estáticos, PWA manifest, sw.js, íconos
├── android/                      # Proyecto Android generado por Capacitor
├── capacitor.config.ts           # Config Capacitor (App ID: com.sosecure.app)
└── next.config.ts                # Config Next.js (output: export)
```

---

## Notas de Arquitectura

- **Un solo watcher GPS** vive en `app-shell.tsx`; todos los tabs consumen `currentLocation` del store de Zustand — no llamar `useGeolocation` directamente desde los tabs.
- **Stream de cámara SOS**: `sos-button.tsx` captura el `MediaStream` y lo guarda en `sosStream` del store. `during-tab.tsx` reutiliza ese stream para evitar el error de cámara ocupada en Android.
- **VolumeButtonPlugin** existe solo como `.java` — no crear versión `.kt` (causaría redeclaración en compilación).
- **`sos_locations`** usa `.update()` para actualizar ubicación, no `.upsert()`, porque `alert_id` no tiene restricción `UNIQUE`.
- **`usePremium()`** hace una llamada RPC al montar; mientras `loading === true` no se muestran banners de bloqueo para evitar flicker.
- **`simpleMode`** es un campo booleano en el store de Zustand (persistido). Todos los tabs lo leen para adaptar su presentación: ocultan secciones avanzadas, agrandan íconos y texto. Se activa desde el toggle "Modo Simple" en Ajustes.
- **Desarrollo en Android**: usar `localhost` con ADB port forward, no la IP de la PC (HTTP sobre IP no es "secure context" y `navigator.mediaDevices` queda `undefined`).

---

## Despliegue

- **Producción Web**: Vercel — `https://sosecure-ten.vercel.app`
- **Branch principal**: `main`
- **APK**: El export estático (`/out`) es el que empaqueta Capacitor para Android
