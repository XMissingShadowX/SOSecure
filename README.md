# SOSecure — Aplicación de Seguridad Personal

> SOS de Emergencia • Mapa Comunitario de Incidentes • Rutas Seguras • Paramédico con IA

---

## Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 🆘 SOS con Pulsación Prolongada | Mantén 2 segundos → llama a 3 contactos, envía SMS con GPS, graba 10s de video |
| 🗺️ Mapa Comunitario de Incidentes | Mapa en tiempo real con Leaflet y zonas por colores (rojo=asalto, ámbar=sospechoso) |
| 🛣️ Sugerencias de Rutas Seguras | 1-3 rutas alternativas evitando zonas de peligro con puntuaciones de seguridad |
| 🤖 Chat Paramédico con IA | Asistente de primeros auxilios impulsado por Claude con instrucciones offline de respaldo |
| 👤 Autenticación y Gestión de Contactos | Autenticación con Supabase, hasta 3 contactos de emergencia |

---

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router, exportación estática) + Tailwind CSS v4 + shadcn/ui
- **Estado**: Zustand (persistido)
- **Mapa**: Leaflet + react-leaflet (OpenStreetMap / CartoDB Dark)
- **Backend**: Supabase (autenticación + postgres + tiempo real)
- **IA**: Anthropic Claude (claude-haiku-4-5)
- **Móvil**: Capacitor v6

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
-- Contactos de emergencia
create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  priority int default 1,
  created_at timestamptz default now()
);
alter table emergency_contacts enable row level security;
create policy "Los usuarios gestionan sus propios contactos" on emergency_contacts
  for all using (auth.uid() = user_id);

-- Alertas SOS
create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  latitude float8 not null,
  longitude float8 not null,
  status text default 'active',
  contacts_notified text[],
  created_at timestamptz default now(),
  resolved_at timestamptz
);
alter table sos_alerts enable row level security;
create policy "Los usuarios gestionan sus propias alertas" on sos_alerts
  for all using (auth.uid() = user_id);

-- Incidentes comunitarios
create table incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  incident_type text not null,
  severity text not null,
  latitude float8 not null,
  longitude float8 not null,
  is_active boolean default true,
  reported_at timestamptz default now(),
  resolved_at timestamptz
);
alter table incidents enable row level security;
create policy "Cualquiera puede leer incidentes activos" on incidents
  for select using (is_active = true);
create policy "Usuarios autenticados pueden insertar" on incidents
  for insert with check (auth.uid() is not null);
create policy "Los usuarios pueden actualizar los suyos" on incidents
  for update using (auth.uid() = user_id);
```

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

## Permisos de Android (agregados automáticamente por Capacitor)

Los siguientes permisos se añaden al `AndroidManifest.xml` de forma automática:
- `ACCESS_FINE_LOCATION` — Rastreo GPS
- `ACCESS_COARSE_LOCATION` — Ubicación por red
- `CAMERA` — Grabación de video de 10 segundos al activar SOS
- `VIBRATE` — Vibración háptica al activar SOS
- `RECEIVE_BOOT_COMPLETED` — Servicios en segundo plano

---

## Estructura del Proyecto

```
safewalk/
├── app/
│   ├── page.tsx              # Inicio (verificación de autenticación en cliente)
│   ├── globals.css           # Variables CSS del tema oscuro
│   ├── layout.tsx            # Layout raíz + metadatos PWA
│   └── auth/
│       ├── login/page.tsx
│       ├── sign-up/page.tsx
│       └── callback/page.tsx
├── components/
│   ├── app-shell.tsx         # Shell principal con encabezado y navegación
│   ├── sos-button.tsx        # Botón SOS con activación por pulsación prolongada
│   ├── bottom-navigation.tsx
│   ├── incident-map.tsx      # Componente del mapa con Leaflet
│   └── tabs/
│       ├── home-tab.tsx      # Estado + gestión de contactos
│       ├── map-tab.tsx       # Mapa comunitario de incidentes
│       ├── routes-tab.tsx    # Planificador de rutas seguras
│       └── medic-tab.tsx     # Chat paramédico con IA
├── lib/
│   ├── store.ts              # Estado global con Zustand
│   ├── types.ts              # Tipos de TypeScript
│   ├── utils.ts              # Helper cn()
│   └── supabase/
│       ├── client.ts         # Cliente Supabase para el navegador
│       └── server.ts         # Cliente Supabase para el servidor
├── hooks/
│   └── use-geolocation.ts    # Hook de GPS con modo watch
├── capacitor.config.ts       # Configuración de Capacitor para APK
└── next.config.ts            # Configuración de exportación estática
```
