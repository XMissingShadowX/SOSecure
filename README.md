# SOSecure — Aplicación de Seguridad Personal

> SOS de Emergencia • Mapa Comunitario de Incidentes • Rutas Seguras • Paramédico con IA

---

## Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 🆘 SOS con Pulsación Prolongada | Mantén 1 segundo el botón → graba video/audio, envía ubicación GPS a Supabase y notifica a contactos de emergencia por correo |
| 🔊 Activación SOS por Volumen | Presiona subir o bajar volumen 5 veces en 3 segundos para activar el SOS sin tocar la pantalla |
| 🗣️ Activación SOS por Voz | Detección de palabras clave ("auxilio", "ayuda", "sos", "emergencia") mediante reconocimiento de voz |
| 📹 Grabación de Video/Audio SOS | Graba automáticamente desde la cámara trasera al activar SOS; guarda localmente o sube a Supabase Storage vinculado a la alerta |
| 📡 Seguimiento en Tiempo Real | Página pública de emergencia (`/emergency/[id]`) que muestra la ubicación del usuario en tiempo real durante una alerta activa |
| 📧 Notificaciones por Correo | Envío de correo automático a contactos con nombre del usuario, coordenadas GPS y enlace de seguimiento en tiempo real |
| 🗺️ Mapa Comunitario de Incidentes | Mapa interactivo en tiempo real con Leaflet; marcadores por severidad (rojo=alto, ámbar=medio, azul=bajo) |
| 🔥 Mapa de Calor | Toggle entre vista de marcadores y mapa de calor (leaflet.heat) con degradado de colores según densidad e intensidad |
| 🗳️ Sistema de Votos | Usuarios pueden votar si un incidente es real o falso; los incidentes con muchos votos falsos se desactivan automáticamente |
| 📋 Formulario de Reporte Inteligente | Preguntas contextuales según el tipo de incidente (robo, acoso, accidente) para calcular severidad automáticamente |
| 🛣️ Rutas Seguras con OSRM | Hasta 3 rutas alternativas calculadas con OSRM con distancia, tiempo y puntuación de seguridad según incidentes en la ruta |
| 📍 Lugares Frecuentes | Guarda hasta 5 lugares frecuentes con geocodificación (casa, trabajo, etc.) para planificar rutas rápidamente |
| ⏱️ Temporizador de Seguridad | Activa un contador; si no confirmas tu llegada antes de que expire, se alerta automáticamente a tus contactos |
| 🤖 Chat Paramédico con IA | Asistente de primeros auxilios impulsado por Claude (claude-haiku-4-5) con instrucciones offline de respaldo |
| 📶 Modo Offline | Los reportes de incidentes se guardan localmente y se sincronizan automáticamente al recuperar conexión |
| 👤 Gestión de Contactos | Autenticación con Supabase, hasta 10 contactos de emergencia con niveles de importancia (principal, secundario, terciario) |
| 🌙 Tema Claro / Oscuro | Soporte completo de tema claro y oscuro con detección automática y cambio manual |

---

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router, exportación estática) + Tailwind CSS v4 + shadcn/ui
- **Estado**: Zustand (persistido en localStorage)
- **Mapa**: Leaflet + react-leaflet + leaflet.heat (OpenStreetMap / CartoDB)
- **Rutas**: OSRM (Open Source Routing Machine)
- **Geocodificación**: Nominatim (OpenStreetMap)
- **Backend**: Supabase (autenticación + PostgreSQL + tiempo real + Storage + Edge Functions)
- **IA**: Anthropic Claude (claude-haiku-4-5)
- **Móvil**: Capacitor v6
- **PWA**: Service Worker con caché offline

---

## Variables de Entorno

Crea un archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
NEXT_PUBLIC_ANTHROPIC_API_KEY=tu-clave-anthropic
```

---

## Esquema de Supabase

Ejecuta este SQL en tu proyecto de Supabase:

```sql
-- Extensiones necesarias
create extension if not exists pgcrypto;

-- Contactos de emergencia
create table emergency_contacts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  phone        text        not null,
  relationship text,
  priority     int         default 1,
  importance   text        not null default 'secondary'
                           check (importance in ('primary','secondary','tertiary')),
  created_at   timestamptz default now()
);
alter table emergency_contacts enable row level security;
create policy "Los usuarios gestionan sus propios contactos" on emergency_contacts
  for all using (auth.uid() = user_id);

-- Alertas SOS
create table sos_alerts (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users(id) on delete cascade,
  latitude           float8      not null,
  longitude          float8      not null,
  status             text        default 'active',
  contacts_notified  text[],
  video_url          text,
  created_at         timestamptz default now(),
  resolved_at        timestamptz
);
alter table sos_alerts enable row level security;
create policy "Los usuarios gestionan sus propias alertas" on sos_alerts
  for all using (auth.uid() = user_id);
create policy "Lectura pública de alertas activas" on sos_alerts
  for select using (status = 'active');

-- Ubicaciones SOS en tiempo real
create table sos_locations (
  alert_id    uuid        references sos_alerts(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete cascade,
  latitude    float8      not null,
  longitude   float8      not null,
  updated_at  timestamptz default now(),
  primary key (alert_id)
);
alter table sos_locations enable row level security;
create policy "Lectura pública de ubicaciones activas" on sos_locations
  for select using (true);
create policy "El usuario inserta/actualiza su ubicación" on sos_locations
  for all using (auth.uid() = user_id);

-- Incidentes comunitarios
create table incidents (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete set null,
  title          text        not null,
  description    text,
  incident_type  text        not null,
  severity       text        not null,
  latitude       float8      not null,
  longitude      float8      not null,
  is_active      boolean     default true,
  is_verified    boolean     default false,
  votes_real     int         default 0,
  votes_fake     int         default 0,
  false_alarm_count int      default 0,
  reported_at    timestamptz default now(),
  resolved_at    timestamptz
);
alter table incidents enable row level security;
create policy "Cualquiera puede leer incidentes activos" on incidents
  for select using (is_active = true);
create policy "Usuarios autenticados pueden insertar" on incidents
  for insert with check (auth.uid() is not null);
create policy "Los usuarios pueden actualizar los suyos" on incidents
  for update using (auth.uid() = user_id);
create policy "Lectura pública para página de emergencia" on incidents
  for select using (true);

-- RPC para incrementar votos
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

-- Grabaciones de video/audio SOS
create table if not exists public.recordings (
  id               uuid             primary key default gen_random_uuid(),
  user_id          uuid             not null references auth.users(id) on delete cascade,
  storage_path     text             not null,
  public_url       text,
  recording_type   text             not null check (recording_type in ('audio', 'video')),
  mime_type        text             not null,
  duration_ms      integer          not null default 0,
  file_size_bytes  bigint           not null default 0,
  latitude         double precision,
  longitude        double precision,
  sos_alert_id     uuid             references public.sos_alerts(id) on delete set null,
  created_at       timestamptz      not null default now()
);
alter table public.recordings enable row level security;
create policy "select_own" on public.recordings for select using (auth.uid() = user_id);
create policy "insert_own" on public.recordings for insert with check (auth.uid() = user_id);
create policy "delete_own" on public.recordings for delete using (auth.uid() = user_id);

-- Bucket de Storage para grabaciones
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

El proyecto utiliza dos Edge Functions desplegadas en Supabase:

| Función | Descripción |
|---|---|
| `notify-contacts` | Envía correo a los contactos de emergencia con nombre, coordenadas GPS y enlace de seguimiento al activar SOS |
| `notify-nearby-users` | Notifica a usuarios cercanos cuando se reporta un nuevo incidente en su zona |

---

## Compilación y Despliegue (Web)

```bash
npm install
npm run build
# Los archivos estáticos se generan en el directorio /out
```

---

## Compilación del APK (Android)

### Requisitos Previos
- Node.js 18+
- Java JDK 17+
- Android Studio (con SDK 34+)
- Gradle

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/geolocation @capacitor/haptics @capacitor/splash-screen

# 3. Compilar la exportación estática de Next.js
npm run build
# Esto crea el directorio /out

# 4. Agregar la plataforma Android
npx cap add android

# 5. Sincronizar los archivos web con Android
npx cap sync android

# 6. Abrir en Android Studio
npx cap open android

# 7. En Android Studio: Build > Build Bundle(s)/APK(s) > Build APK(s)
#    El APK estará en: android/app/build/outputs/apk/debug/app-debug.apk
```

### Comando único (después de configurar Android Studio)
```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
# Salida: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Permisos de Android

Los siguientes permisos se añaden al `AndroidManifest.xml`:

- `ACCESS_FINE_LOCATION` — Rastreo GPS
- `ACCESS_COARSE_LOCATION` — Ubicación por red
- `CAMERA` — Grabación de video al activar SOS
- `RECORD_AUDIO` — Grabación de audio al activar SOS
- `VIBRATE` — Vibración háptica al activar SOS
- `RECEIVE_BOOT_COMPLETED` — Servicios en segundo plano

---

## Estructura del Proyecto

```
sosecure/
├── app/
│   ├── page.tsx                  # Pantalla inicial (auth + splash)
│   ├── globals.css               # Variables CSS del tema + estilos Leaflet
│   ├── layout.tsx                # Layout raíz + metadatos PWA
│   ├── emergency/[id]/page.tsx   # Página pública de seguimiento de emergencia
│   └── auth/
│       ├── login/page.tsx
│       ├── sign-up/page.tsx
│       └── callback/page.tsx
├── components/
│   ├── app-shell.tsx             # Shell principal con encabezado y navegación
│   ├── sos-button.tsx            # Botón SOS (pulsación, volumen, voz, grabación)
│   ├── incident-map.tsx          # Mapa Leaflet con marcadores, heatmap y votos
│   ├── bottom-navigation.tsx     # Barra de navegación inferior
│   └── tabs/
│       ├── home-tab.tsx          # Inicio: ubicación y gestión de contactos
│       ├── before-tab.tsx        # Antes: rutas seguras y temporizador
│       ├── during-tab.tsx        # Durante: mapa de incidentes en tiempo real
│       ├── after-tab.tsx         # Después: reporte post-incidente y votos
│       └── medic-tab.tsx         # Paramédico: chat con IA
├── lib/
│   ├── store.ts                  # Estado global con Zustand (persistido)
│   ├── types.ts                  # Tipos TypeScript
│   ├── utils.ts                  # Helper cn()
│   ├── recordings.ts             # Grabación, descarga y envío a contactos
│   ├── notifications.ts          # Notificaciones push y alarma sonora
│   └── supabase/
│       ├── client.ts             # Cliente Supabase para el navegador
│       └── server.ts             # Cliente Supabase para el servidor
├── hooks/
│   ├── use-geolocation.ts        # Hook de GPS con modo watch
│   └── use-volume-sos.ts         # Hook de activación SOS por botones de volumen
├── supabase/
│   └── migrations/               # Scripts SQL de configuración de la DB
├── capacitor.config.ts           # Configuración de Capacitor para APK
└── next.config.ts                # Configuración de Next.js (exportación estática)
```
