-- ============================================================
-- SOSecure — Cron: disparar process-scheduled-deletions cada hora
-- Ejecutar en: Supabase > SQL Editor
--
-- Antes de correr esto:
--   1. Desplegar la función:
--        supabase functions deploy process-scheduled-deletions --no-verify-jwt
--      (--no-verify-jwt es necesario: pg_cron llama por HTTP externo sin un
--      JWT de usuario; la función se protege igual con su propio secreto,
--      ver supabase/functions/process-scheduled-deletions/index.ts)
--   2. Configurar el secreto que la función espera en el header
--      X-Cron-Secret:
--        supabase secrets set CRON_SECRET=<valor-largo-aleatorio>
--   3. Reemplazar los dos placeholders de abajo:
--        <PROJECT_REF>   — el ref del proyecto (ej. abcdefghijklmnop)
--        <CRON_SECRET>   — el mismo valor que se configuró en el paso 2
--
-- Se eligió pg_cron + net.http_post (extensiones nativas de Supabase) en
-- vez del Cron nativo de Edge Functions (config en supabase/config.toml)
-- porque así el schedule queda versionado como SQL igual que el resto de
-- las migraciones, en vez de vivir solo en el dashboard o en un archivo de
-- config que no se estaba versionando hasta ahora.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'process-scheduled-deletions',
  '0 * * * *', -- cada hora en punto
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-scheduled-deletions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para desprogramarlo más adelante:
-- select cron.unschedule('process-scheduled-deletions');
