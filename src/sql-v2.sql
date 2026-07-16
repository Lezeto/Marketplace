-- ============================================================================
-- MIGRACIÓN V2 — Marketplace de productos y servicios (estilo yapo.cl)
-- Ejecutar COMPLETO en el SQL Editor de Supabase (una sola pasada, es idempotente).
-- Requiere que ya exista el esquema v1 (src/sql.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) listings2: nuevos atributos del aviso
-- ----------------------------------------------------------------------------
alter table public.listings2
  add column if not exists type text not null default 'producto',
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists condition text,          -- nuevo | usado (solo productos)
  add column if not exists stock integer,           -- solo productos
  add column if not exists shipping text,           -- retiro | envio | ambos (solo productos)
  add column if not exists price_type text not null default 'fijo', -- fijo | negociable | por_hora | por_trabajo | convenir
  add column if not exists comuna text,
  add column if not exists images jsonb not null default '[]'::jsonb, -- hasta 6 URLs
  add column if not exists status text not null default 'active',     -- active | paused | sold
  add column if not exists views integer not null default 0,
  add column if not exists refreshed_at timestamptz not null default now(),
  add column if not exists currency text not null default 'CLP',  -- CLP | UF (UF para inmuebles)
  add column if not exists badge text;                            -- etiqueta: nuevo | poco_uso | oportunidad | urgente

-- Registro de backfills ya aplicados (hace la migración re-ejecutable sin
-- pisar datos posteriores, p. ej. renovaciones de avisos).
create table if not exists public.schema_migrations2 (
  key text primary key,
  applied_at timestamptz default now()
);
alter table public.schema_migrations2 enable row level security;
-- (sin políticas: solo accesible vía service key)

-- Backfill de datos v1 → v2 (solo la primera vez):
--  - la imagen única pasa a la galería
--  - la fecha de renovación parte igual a la de creación
--  - los avisos v1 sin categoría quedan en "otros-productos"
do $$ begin
  if not exists (select 1 from public.schema_migrations2 where key = 'v2_backfill_listings') then
    update public.listings2
      set images = jsonb_build_array(image_url)
      where image_url is not null and images = '[]'::jsonb;

    update public.listings2 set refreshed_at = created_at
      where refreshed_at is distinct from created_at;

    update public.listings2
      set category = 'otros-productos'
      where category is null and type = 'producto';

    insert into public.schema_migrations2 (key) values ('v2_backfill_listings');
  end if;
end $$;

-- Restricciones de dominio (nombres únicos para idempotencia)
do $$ begin
  alter table public.listings2 add constraint listings2_type_chk
    check (type in ('producto','servicio'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_status_chk
    check (status in ('active','paused','sold'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_price_type_chk
    check (price_type in ('fijo','negociable','por_hora','por_trabajo','convenir'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_condition_chk
    check (condition is null or condition in ('nuevo','usado'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_shipping_chk
    check (shipping is null or shipping in ('retiro','envio','ambos'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_currency_chk
    check (currency in ('CLP','UF'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings2 add constraint listings2_badge_chk
    check (badge is null or badge in ('nuevo','poco_uso','oportunidad','urgente'));
exception when duplicate_object then null; end $$;

-- Índices para búsqueda y orden del listado
create index if not exists listings2_status_refreshed_idx on public.listings2 (status, refreshed_at desc);
create index if not exists listings2_type_idx on public.listings2 (type);
create index if not exists listings2_category_idx on public.listings2 (category);
create index if not exists listings2_comuna_idx on public.listings2 (comuna);
create index if not exists listings2_price_idx on public.listings2 (price);

-- ----------------------------------------------------------------------------
-- 2) profiles2: teléfono de contacto (opcional, se muestra en el aviso)
-- ----------------------------------------------------------------------------
alter table public.profiles2
  add column if not exists phone text,
  add column if not exists show_phone boolean not null default false;

-- ----------------------------------------------------------------------------
-- 3) favorites2: avisos guardados por usuario
-- ----------------------------------------------------------------------------
create table if not exists public.favorites2 (
  user_id uuid references auth.users(id) on delete cascade,
  listing_id bigint references public.listings2(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

alter table public.favorites2 enable row level security;

do $$ begin
  create policy "favorites read own" on public.favorites2
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "favorites insert own" on public.favorites2
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "favorites delete own" on public.favorites2
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 4) reviews2: reseñas con nota 1-5 sobre un vendedor / prestador
--    (una reseña por usuario evaluador y vendedor; editable)
-- ----------------------------------------------------------------------------
create table if not exists public.reviews2 (
  id bigint generated always as identity primary key,
  reviewer_id uuid references auth.users(id) on delete cascade,
  reviewer_username text,
  seller_id uuid references auth.users(id) on delete cascade,
  seller_username text,
  listing_id bigint references public.listings2(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, seller_id)
);

create index if not exists reviews2_seller_idx on public.reviews2 (seller_id);

alter table public.reviews2 enable row level security;

do $$ begin
  create policy "reviews read all" on public.reviews2
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reviews insert own" on public.reviews2
    for insert with check (auth.uid() = reviewer_id and reviewer_id <> seller_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reviews update own" on public.reviews2
    for update using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "reviews delete own" on public.reviews2
    for delete using (auth.uid() = reviewer_id);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 5) reports2: denuncias de avisos
-- ----------------------------------------------------------------------------
create table if not exists public.reports2 (
  id bigint generated always as identity primary key,
  listing_id bigint references public.listings2(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  detail text,
  created_at timestamptz default now()
);

-- Una denuncia por usuario y aviso (evita inundar reports2 contra un aviso)
create unique index if not exists reports2_unique_reporter_listing
  on public.reports2 (listing_id, reporter_id);

create index if not exists reports2_listing_idx on public.reports2 (listing_id);

alter table public.reports2 enable row level security;

do $$ begin
  create policy "reports insert by authed" on public.reports2
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
-- (sin política de select: solo el service key del serverless puede leerlas)

-- ----------------------------------------------------------------------------
-- 6) Contador de visitas del aviso
-- ----------------------------------------------------------------------------
create or replace function public.increment_listing_views2(lid bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings2 set views = views + 1 where id = lid;
$$;

-- Solo el serverless (service key) puede invocarla; si quedara abierta a anon,
-- cualquiera podría inflar el contador vía PostgREST.
revoke all on function public.increment_listing_views2(bigint) from public;
revoke all on function public.increment_listing_views2(bigint) from anon;
revoke all on function public.increment_listing_views2(bigint) from authenticated;
grant execute on function public.increment_listing_views2(bigint) to service_role;

-- ----------------------------------------------------------------------------
-- 7) Storage: bucket público para las fotos de los avisos
--    (la app sube a listings2/<user_id>/<archivo>)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listings2', 'listings2', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Eliminar las políticas del deploy v1 (nombres antiguos): la de INSERT no
-- restringía la carpeta, así que permitía subir a la carpeta de otro usuario.
-- Se reemplazan por el set de abajo, todas acotadas a <user_id>/... como fuente
-- única de verdad. (idempotente: si no existen, no hace nada)
drop policy if exists "listings2 insert auth users" on storage.objects;
drop policy if exists "listings2 read public" on storage.objects;
drop policy if exists "listings2 delete own" on storage.objects;
drop policy if exists "listings2 update own" on storage.objects;

do $$ begin
  create policy "listings2 public read" on storage.objects
    for select using (bucket_id = 'listings2');
exception when duplicate_object then null; end $$;

-- Cada usuario solo puede subir dentro de su propia carpeta (<user_id>/...)
do $$ begin
  create policy "listings2 upload by authed" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'listings2' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

-- Actualizar (sobrescribir) solo archivos propios; la app no lo usa hoy
-- (sube con upsert:false), pero se deja acotado para no dejar la operación abierta.
do $$ begin
  create policy "listings2 update own files" on storage.objects
    for update to authenticated
    using (bucket_id = 'listings2' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "listings2 delete own files" on storage.objects
    for delete to authenticated
    using (bucket_id = 'listings2' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 8) Endurecer RLS heredado de v1: el insert de chat solo con el propio user_id
--    (la política v1 permitía suplantar user_id/username con la anon key)
-- ----------------------------------------------------------------------------
drop policy if exists "chat insert by user" on public.chat_messages2;
do $$ begin
  create policy "chat insert by owner" on public.chat_messages2
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ============================================================================
-- FIN DE LA MIGRACIÓN.
-- Paso manual adicional (fuera de SQL, en el Dashboard de Supabase):
--   Authentication → Providers → habilitar Google y/o Facebook si se quiere
--   login social. Ver PASOS_FINALES.md.
-- ============================================================================
