# Plan Free vs Premium — Implementación SOSecure

## Decisiones confirmadas

| # | Decisión |
|---|----------|
| 1 | `FREE_MAX_CONTACTS = 2` (cambiar de 3 a 2 en `lib/plan-config.ts`) |
| 2 | Reutilizar hook `usePremium()` existente (llama a RPC `has_premium_access`) |
| 3 | Contador de búsquedas de ruta: nueva tabla `route_searches` en Supabase |
| 4 | Historial SOS: nueva card en `after-tab.tsx`, arriba de "Mis grabaciones", con filtro 1 semana / 1 / 3 / 6 meses |
| 5 | "Mis grabaciones" NO se bloquea para free |
| 6 | Transmisión de ubicación SOS: siempre activa para todos |
| 7 | Banner de upgrade muestra botones para `/plan-premium/pago` Y `/plan-familiar/pago` |
| 8 | Tracking compartido (temporizador compartido): se OCULTA para free |
| 9 | Chat IA (medic-tab): banner de upgrade en lugar del chat |
| 10 | Grabación de video: se detiene automáticamente a los 30s, muestra countdown |
| 11 | Rutas alternativas: se muestran bloqueadas con candado (free ve 1, otras 2 con lock) |
| 12 | notify-nearby-users: se llama siempre (sin restricción de plan) |

---

## Matriz de features

| Feature | Free | Premium/Familiar |
|---------|------|-----------------|
| Botón SOS (hold, volumen, voz) | ✅ ilimitado | ✅ ilimitado |
| Notificación email a contactos | ✅ | ✅ |
| Transmisión de ubicación SOS | ✅ siempre | ✅ siempre |
| Grabación de audio | ✅ ilimitado | ✅ ilimitado |
| Grabación de video | ✅ máx 30s + countdown | ✅ ilimitado |
| Contactos de emergencia | ✅ máx 2 | ✅ máx 10 |
| Mapa comunitario de incidentes | ✅ | ✅ |
| Rutas seguras | ✅ 1/día, 1 ruta visible | ✅ ilimitado, 3 rutas |
| Rutas alternativas (2 extra) | 🔒 banners con lock | ✅ |
| Zonas seguras en mapa | ✅ | ✅ |
| Temporizador de seguridad | ✅ | ✅ |
| Tracking compartido (timer compartido) | ❌ oculto | ✅ |
| Chat IA (medic-tab) | 🔒 banner upgrade | ✅ ilimitado |
| Historial de alertas SOS | 🔒 banner upgrade | ✅ con filtro tiempo |
| Mis grabaciones (after-tab) | ✅ | ✅ |
| notify-nearby-users | ✅ siempre | ✅ siempre |
| Plan Familiar | ❌ | ✅ hasta 5 miembros |

---

## Archivos a crear

### 1. `components/upgrade-banner.tsx` (NUEVO)
Componente reutilizable. Props:
```ts
interface UpgradeBannerProps {
  title: string           // "Función Premium"
  description: string     // descripción de la función bloqueada
  compact?: boolean       // versión pequeña para locks inline en rutas
}
```
- Muestra título, descripción y dos botones:
  - "Plan Premium — $59/mes" → `/plan-premium/pago`
  - "Plan Familiar — $499/año" → `/plan-familiar/pago`
- Usa icono `Lock` o `Sparkles` de lucide-react
- Estilo: `border-primary/30 bg-primary/5`

### 2. `supabase/migrations/XXXX_route_searches.sql` (NUEVO)
```sql
create table route_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  searched_at timestamptz default now() not null
);

-- RPC para contar búsquedas de hoy
create or replace function count_route_searches_today(p_user_id uuid)
returns int language sql security definer as $$
  select count(*)::int
  from route_searches
  where user_id = p_user_id
    and searched_at >= date_trunc('day', now() at time zone 'America/Mexico_City');
$$;

-- RPC para registrar una búsqueda
create or replace function insert_route_search(p_user_id uuid)
returns void language sql security definer as $$
  insert into route_searches (user_id) values (p_user_id);
$$;

-- RLS
alter table route_searches enable row level security;
create policy "users own searches" on route_searches
  for all using (auth.uid() = user_id);
```

### 3. `hooks/use-premium.ts` — verificar si ya existe o crearlo
El agente confirmó que ya existe. Verificar que devuelva `{ isPremium: boolean, loading: boolean }`.
Si no existe, crearlo:
```ts
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('has_premium_access').then(({ data }) => {
      setIsPremium(!!data)
      setLoading(false)
    })
  }, [])
  return { isPremium, loading }
}
```

---

## Archivos a modificar

### 4. `lib/plan-config.ts`
- Línea 65: cambiar `FREE_MAX_CONTACTS = 3` → `FREE_MAX_CONTACTS = 2`

### 5. `components/tabs/home-tab.tsx`
- Importar `usePremium` y `FREE_MAX_CONTACTS`
- Línea 43: reemplazar `const MAX_CONTACTS = 10` por:
  ```ts
  const { isPremium } = usePremium()
  const MAX_CONTACTS = isPremium ? PREMIUM_PLAN.features.maxContacts : FREE_MAX_CONTACTS
  ```
- Línea 136: cuando `contacts.length >= MAX_CONTACTS` y `!isPremium`, mostrar `<UpgradeBanner>` en lugar de simplemente retornar
- Línea 487, 500, 545: ya usan `MAX_CONTACTS`, se actualizan solos al cambiar la constante

### 6. `components/tabs/medic-tab.tsx`
- Importar `usePremium` y `UpgradeBanner`
- Al inicio del return: si `!isPremium && !loading`, renderizar `<UpgradeBanner>` en lugar del chat completo:
  ```tsx
  if (!loading && !isPremium) return (
    <div className="flex flex-col h-[calc(100vh-8rem)] pb-36 items-center justify-center p-4">
      <UpgradeBanner
        title="Chat de Apoyo Psicológico"
        description="El acompañante de bienestar con IA está disponible solo en planes Premium y Familiar."
      />
    </div>
  )
  ```

### 7. `components/tabs/during-tab.tsx`
- Importar `usePremium`
- En `toggleVideo`: si `!isPremium`, iniciar timer de 30 segundos:
  ```ts
  const VIDEO_FREE_LIMIT_MS = 30_000
  const videoLimitRef = useRef<NodeJS.Timeout | null>(null)
  const [videoSecondsLeft, setVideoSecondsLeft] = useState<number | null>(null)
  ```
- Al iniciar grabación de video en free:
  ```ts
  if (!isPremium) {
    setVideoSecondsLeft(30)
    const countdown = setInterval(() => {
      setVideoSecondsLeft(prev => {
        if (prev === null || prev <= 1) { clearInterval(countdown); toggleVideo(); return null }
        return prev - 1
      })
    }, 1000)
    videoLimitRef.current = countdown
    // también detener con setTimeout
    setTimeout(() => { if (isRecordingVideo) toggleVideo() }, VIDEO_FREE_LIMIT_MS)
  }
  ```
- Mostrar countdown en la UI cuando `videoSecondsLeft !== null`:
  ```tsx
  {videoSecondsLeft !== null && (
    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
      {videoSecondsLeft}s restantes (free)
    </div>
  )}
  ```
- Limpiar el interval en `stopTracking`/cleanup

### 8. `components/tabs/routes-tab.tsx`
- Importar `usePremium` y `UpgradeBanner`
- Añadir prop `hideMap?: boolean` (ya existe según el agente)
- En `handleSearch`: verificar límite diario para free:
  ```ts
  const handleSearch = async () => {
    if (!isPremium) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: count } = await supabase.rpc('count_route_searches_today', { p_user_id: user.id })
        if ((count ?? 0) >= 1) {
          setSearchLimitReached(true)  // nuevo estado
          return
        }
        await supabase.rpc('insert_route_search', { p_user_id: user.id })
      }
    }
    // … lógica existente de búsqueda
  }
  ```
- Cuando `searchLimitReached`: mostrar `<UpgradeBanner>` en lugar del formulario
- En el listado de rutas (`routeOptions.map`): si `!isPremium` y el índice > 0:
  ```tsx
  {routeOptions.map((route, i) => (
    i > 0 && !isPremium ? (
      <div key={route.id} className="relative opacity-60 pointer-events-none">
        {/* card de ruta con blur */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <Lock className="w-5 h-5 text-primary mr-2" />
          <span className="text-sm font-medium">Plan Premium</span>
        </div>
        {/* … misma card pero deshabilitada */}
      </div>
    ) : (
      <RouteCard key={route.id} route={route} ... />
    )
  ))}
  ```

### 9. `components/tabs/before-tab.tsx`
- Importar `usePremium`
- Buscar la sección del temporizador de tracking compartido (alrededor línea 490-613)
- Envolver la sección "Compartir mi ubicación" / tracking con:
  ```tsx
  {isPremium && (
    // … sección de tracking compartido existente
  )}
  ```
- El temporizador de seguridad normal (sin tracking) permanece sin cambios para free

### 10. `components/tabs/after-tab.tsx`
- Importar `usePremium`, `UpgradeBanner`
- Añadir nueva Card **"Historial de Alertas SOS"** ANTES de "Mis grabaciones":

**Estructura de la card:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Historial de Alertas SOS</CardTitle>
  </CardHeader>
  <CardContent>
    {!isPremium ? (
      <UpgradeBanner
        title="Historial de Alertas SOS"
        description="Accede a tus alertas pasadas con ubicación y grabaciones adjuntas."
        compact
      />
    ) : (
      <>
        {/* Filtro de tiempo */}
        <Select value={sosHistoryFilter} onValueChange={setSosHistoryFilter}>
          <SelectTrigger>...</SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Última semana</SelectItem>
            <SelectItem value="1m">Último mes</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
        {/* Lista de alertas */}
        {sosHistory.map(alert => (
          <div key={alert.id}>
            <p>{new Date(alert.created_at).toLocaleString()}</p>
            <p>{alert.latitude}, {alert.longitude}</p>
            {/* grabación si existe */}
          </div>
        ))}
      </>
    )}
  </CardContent>
</Card>
```

**Datos a cargar (nuevo useEffect):**
```ts
const [sosHistory, setSosHistory] = useState<SosAlert[]>([])
const [sosHistoryFilter, setSosHistoryFilter] = useState<'7d'|'1m'|'3m'|'6m'>('1m')

useEffect(() => {
  if (!isPremium) return
  async function fetchSosHistory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const filterMap = { '7d': 7, '1m': 30, '3m': 90, '6m': 180 }
    const days = filterMap[sosHistoryFilter]
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data } = await supabase
      .from('sos_alerts')
      .select('id, created_at, latitude, longitude, status')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    setSosHistory(data ?? [])
  }
  fetchSosHistory()
}, [isPremium, sosHistoryFilter])
```

---

## Orden de implementación recomendado

1. `lib/plan-config.ts` — cambiar FREE_MAX_CONTACTS (1 línea)
2. Verificar/crear `hooks/use-premium.ts`
3. Crear `components/upgrade-banner.tsx`
4. Crear migración SQL `route_searches`
5. `components/tabs/medic-tab.tsx` — bloquear chat
6. `components/tabs/home-tab.tsx` — límite de 2 contactos
7. `components/tabs/during-tab.tsx` — límite 30s video con countdown
8. `components/tabs/routes-tab.tsx` — límite búsquedas + rutas bloqueadas
9. `components/tabs/before-tab.tsx` — ocultar tracking compartido
10. `components/tabs/after-tab.tsx` — nueva card historial SOS

---

## Notas importantes

- `usePremium()` hace una llamada a Supabase al montar. Para evitar flicker, mientras `loading === true` no mostrar banners de bloqueo (mostrar skeleton o nada).
- El RPC `has_premium_access` debe devolver `true` si el usuario tiene `premium_subscriptions` activo O es miembro de `family_groups` activo.
- El countdown de video (30s) debe limpiarse si el usuario detiene manualmente la grabación antes de llegar a 0.
- La tabla `sos_alerts` debe tener columna `user_id` para filtrar por usuario. Verificar antes de implementar el historial.
- Las rutas bloqueadas (índice 1 y 2) deben renderizarse visualmente pero con overlay de lock, no omitirse del DOM.
