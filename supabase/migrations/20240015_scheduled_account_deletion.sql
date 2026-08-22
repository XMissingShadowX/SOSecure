-- ============================================================
-- SOSecure — Borrado de cuenta con periodo de gracia de 30 días
-- Ejecutar en: Supabase > SQL Editor
--
-- Antes, POST /api/delete-account borraba la cuenta al instante con
-- admin.auth.admin.deleteUser(). Ahora solo agenda el borrado: marca
-- scheduled_deletion_at = now() + 30 días y cierra la sesión. El borrado
-- real lo hace la Edge Function process-scheduled-deletions (ver
-- supabase/functions/process-scheduled-deletions/), disparada por cron
-- (ver 20240016_cron_process_scheduled_deletions.sql).
--
-- Si el usuario vuelve a iniciar sesión antes de que se cumpla el plazo,
-- app/auth/login/page.tsx llama a POST /api/delete-account/cancel, que
-- pone scheduled_deletion_at = null — la eliminación queda cancelada.
--
-- No es sensible como pin_hash (no es un secreto), pero sí revela una
-- intención privada del usuario frente a otros ("esta persona va a borrar
-- su cuenta"). La política "Perfil visible por todos" (qual: true) hace
-- SELECT abierto a cualquier columna que quede en el grant de tabla
-- completa, así que a propósito NO se agrega a la lista de columnas
-- otorgadas a authenticated/anon en 20240014_revoke_pin_hash_select.sql.
-- Cualquier lectura de esta columna debe hacerse con el admin client
-- desde una API route (igual que pin_hash/pin_reset_pending).
-- ============================================================

alter table public.profiles
  add column if not exists scheduled_deletion_at timestamptz;

-- La tabla completa ya tiene GRANT SELECT por defecto a authenticated/anon
-- salvo que se haya revocado (ver 20240014). Revocamos explícitamente esta
-- columna sola para no depender de que 20240014 se haya corrido antes o
-- después de esta migración.
revoke select (scheduled_deletion_at) on public.profiles from authenticated, anon;
