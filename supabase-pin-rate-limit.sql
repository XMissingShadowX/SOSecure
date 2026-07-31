-- ─────────────────────────────────────────────────────────────────────────
-- Rate limiting de PIN, persistente entre instancias serverless
-- (reemplaza el placeholder en memoria de app/api/pin/verify/route.ts)
--
-- Cómo aplicarlo: pega este archivo completo en el SQL Editor de tu proyecto
-- Supabase (https://supabase.com/dashboard/project/mtpbgfumbqfiiqgyjcey/sql)
-- y ejecútalo una vez. Después, agrega este bloque a la sección
-- "## Esquema de Supabase" de README.md junto a las demás tablas/RPCs, para
-- que quede documentado igual que el resto del esquema.
-- ─────────────────────────────────────────────────────────────────────────

-- Intentos de PIN por usuario
create table pin_attempts (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  attempt_count int not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);
alter table pin_attempts enable row level security;
-- Sin policies para authenticated/anon a propósito: solo el service role
-- (admin() en la ruta de verify) puede leer/escribir esta tabla.

-- Verifica si el usuario está bloqueado ahora mismo por intentos fallidos
create or replace function check_pin_lockout(p_user_id uuid)
returns table(locked boolean, retry_after_seconds int)
language plpgsql security definer as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until from pin_attempts where user_id = p_user_id;
  if v_locked_until is not null and v_locked_until > now() then
    return query select true, ceil(extract(epoch from (v_locked_until - now())))::int;
  end if;
  return query select false, 0;
end;
$$;

-- Registra un intento de PIN de forma atómica (evita condiciones de carrera
-- entre requests concurrentes del mismo usuario) y devuelve si quedó
-- bloqueado. Un intento exitoso resetea el contador por completo.
create or replace function record_pin_attempt(
  p_user_id uuid,
  p_success boolean,
  p_max_attempts int,
  p_lockout_seconds int
)
returns table(locked boolean, retry_after_seconds int)
language plpgsql security definer as $$
declare
  v_count int;
  v_locked_until timestamptz;
begin
  if p_success then
    delete from pin_attempts where user_id = p_user_id;
    return query select false, 0;
  end if;

  insert into pin_attempts (user_id, attempt_count, updated_at)
  values (p_user_id, 1, now())
  on conflict (user_id) do update
    set attempt_count = pin_attempts.attempt_count + 1,
        updated_at = now()
  returning attempt_count into v_count;

  if v_count >= p_max_attempts then
    v_locked_until := now() + make_interval(secs => p_lockout_seconds);
    update pin_attempts set locked_until = v_locked_until where user_id = p_user_id;
    return query select true, p_lockout_seconds;
  end if;

  return query select false, 0;
end;
$$;
