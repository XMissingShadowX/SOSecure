-- ============================================================
-- SOSecure — Cifrado de teléfonos con pgcrypto + Supabase Vault
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Activar extensión pgcrypto
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 2. Guardar clave de cifrado en Vault
--    IMPORTANTE: cambia 'REEMPLAZA_CON_CLAVE_ALEATORIA_32+_CHARS'
--    por una clave segura generada con:
--    select encode(gen_random_bytes(32), 'base64');
-- ============================================================
select vault.create_secret(
  '***REMOVIDO***',
  'sosecure_phone_enc_key',
  'Clave AES para cifrar teléfonos de contactos de emergencia'
);

-- ============================================================
-- 3. Migrar datos existentes (cifrar teléfonos en texto plano)
--    Solo afecta filas donde el teléfono NO está ya cifrado.
--    Los datos cifrados con pgp en base64 empiezan siempre con 'wcB'.
-- ============================================================
do $$
declare
  enc_key text;
begin
  select decrypted_secret into enc_key
  from vault.decrypted_secrets
  where name = 'sosecure_phone_enc_key';

  update public.emergency_contacts
  set phone = encode(pgp_sym_encrypt(phone, enc_key), 'base64')
  where phone not like 'wcB%';
end;
$$;

-- ============================================================
-- 4. RPC: leer contactos (descifra teléfonos automáticamente)
--    SECURITY DEFINER = corre como owner, la clave nunca llega al cliente
-- ============================================================
create or replace function public.get_my_contacts()
returns table (
  id           uuid,
  user_id      uuid,
  name         text,
  phone        text,
  relationship text,
  priority     int,
  importance   text,
  created_at   timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  enc_key text;
begin
  select decrypted_secret into enc_key
  from vault.decrypted_secrets
  where name = 'sosecure_phone_enc_key';

  return query
    select
      ec.id,
      ec.user_id,
      ec.name,
      pgp_sym_decrypt(decode(ec.phone, 'base64'), enc_key)::text as phone,
      ec.relationship,
      ec.priority,
      ec.importance::text,
      ec.created_at
    from public.emergency_contacts ec
    where ec.user_id = auth.uid()
    order by ec.priority;
end;
$$;

-- ============================================================
-- 5. RPC: insertar contacto (cifra el teléfono antes de guardar)
-- ============================================================
create or replace function public.add_emergency_contact(
  p_name         text,
  p_phone        text,
  p_email        text    default null,
  p_relationship text    default null,
  p_priority     int     default 1,
  p_importance   text    default 'secondary'
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  enc_key text;
  new_id  uuid;
begin
  select decrypted_secret into enc_key
  from vault.decrypted_secrets
  where name = 'sosecure_phone_enc_key';

  insert into public.emergency_contacts
    (user_id, name, phone, relationship, priority, importance)
  values (
    auth.uid(),
    p_name,
    encode(pgp_sym_encrypt(p_phone, enc_key), 'base64'),
    p_relationship,
    p_priority,
    p_importance
  )
  returning id into new_id;

  return json_build_object(
    'id',           new_id,
    'user_id',      auth.uid(),
    'name',         p_name,
    'phone',        p_phone,
    'relationship', p_relationship,
    'priority',     p_priority,
    'importance',   p_importance,
    'created_at',   now()
  );
end;
$$;

-- ============================================================
-- 6. RPC: actualizar contacto (cifra el teléfono nuevo)
-- ============================================================
create or replace function public.update_emergency_contact(
  p_id           uuid,
  p_name         text,
  p_phone        text,
  p_email        text  default null,
  p_relationship text  default null,
  p_importance   text  default 'secondary'
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  enc_key text;
begin
  select decrypted_secret into enc_key
  from vault.decrypted_secrets
  where name = 'sosecure_phone_enc_key';

  update public.emergency_contacts
  set
    name         = p_name,
    phone        = encode(pgp_sym_encrypt(p_phone, enc_key), 'base64'),
    relationship = p_relationship,
    importance   = p_importance
  where id = p_id
    and user_id = auth.uid();

  return json_build_object(
    'id',           p_id,
    'name',         p_name,
    'phone',        p_phone,
    'relationship', p_relationship,
    'importance',   p_importance
  );
end;
$$;

-- ============================================================
-- 7. Permisos: solo usuarios autenticados pueden llamar las RPCs
-- ============================================================
revoke execute on function public.get_my_contacts()                                      from anon;
revoke execute on function public.add_emergency_contact(text,text,text,text,int,text)    from anon;
revoke execute on function public.update_emergency_contact(uuid,text,text,text,text,text) from anon;

grant execute on function public.get_my_contacts()                                       to authenticated;
grant execute on function public.add_emergency_contact(text,text,text,text,int,text)     to authenticated;
grant execute on function public.update_emergency_contact(uuid,text,text,text,text,text) to authenticated;
