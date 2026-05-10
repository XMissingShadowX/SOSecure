-- ============================================================
-- SafeWalk — tabla recordings + bucket Storage
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1. Tabla recordings
-- ============================================================
create table if not exists public.recordings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  storage_path    text not null,
  public_url      text,
  recording_type  text not null check (recording_type in ('audio', 'video')),
  mime_type       text not null,
  duration_ms     bigint,
  file_size_bytes bigint,
  latitude        double precision,
  longitude       double precision,
  sos_alert_id    uuid references public.sos_alerts(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Índices útiles
create index if not exists recordings_user_id_idx      on public.recordings(user_id);
create index if not exists recordings_created_at_idx   on public.recordings(created_at desc);
create index if not exists recordings_sos_alert_id_idx on public.recordings(sos_alert_id);

-- 2. Row-Level Security
-- ============================================================
alter table public.recordings enable row level security;

-- Solo el dueño puede leer sus grabaciones
create policy "recordings: owner can select"
  on public.recordings for select
  using (auth.uid() = user_id);

-- Solo el dueño puede insertar
create policy "recordings: owner can insert"
  on public.recordings for insert
  with check (auth.uid() = user_id);

-- Solo el dueño puede eliminar
create policy "recordings: owner can delete"
  on public.recordings for delete
  using (auth.uid() = user_id);

-- 3. Bucket Storage "recordings"
-- ============================================================
-- Ejecutar desde el SQL Editor (requiere extensión storage habilitada)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,                          -- bucket PRIVADO
  52428800,                       -- 50 MB por archivo
  array['audio/webm','video/webm','audio/mp4','video/mp4','audio/ogg']
)
on conflict (id) do nothing;

-- RLS en storage: cada usuario solo accede a su carpeta  <user_id>/*
create policy "storage recordings: owner read"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage recordings: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage recordings: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
