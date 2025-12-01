-- Auth users exist in auth.users, no changes required.

-- 1) profiles2: one row per auth.user
create table if not exists public.profiles2 (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  age int,
  gender text,
  address text,
  occupation text,
  motivation text,
  created_at timestamptz default now()
);

-- 2) chat_messages2: global chat
create table if not exists public.chat_messages2 (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  username text,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists chat_messages2_created_at_idx on public.chat_messages2 (created_at);
create index if not exists chat_messages2_id_idx on public.chat_messages2 (id);

-- 3) listings2: marketplace listings
create table if not exists public.listings2 (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  title text not null,
  address text not null,
  price numeric not null,
  description text not null,
  image_url text,
  region_code text,
  created_at timestamptz default now()
);

create index if not exists listings2_user_id_idx on public.listings2 (user_id);
create index if not exists listings2_username_idx on public.listings2 (username);
create index if not exists listings2_region_code_idx on public.listings2 (region_code);
create index if not exists listings2_id_desc_idx on public.listings2 (id desc);

-- 4) threads2: DM threads between two users, optional listing_id
create table if not exists public.threads2 (
  id bigint generated always as identity primary key,
  user_a_id uuid references auth.users(id) on delete cascade,
  user_b_id uuid references auth.users(id) on delete cascade,
  user_a_username text,
  user_b_username text,
  listing_id bigint references public.listings2(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists threads2_users_idx on public.threads2 (user_a_id, user_b_id);
create index if not exists threads2_listing_idx on public.threads2 (listing_id);
create index if not exists threads2_id_desc_idx on public.threads2 (id desc);

-- 5) thread_messages2: DM messages inside a thread
create table if not exists public.thread_messages2 (
  id bigint generated always as identity primary key,
  thread_id bigint references public.threads2(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_username text,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists thread_messages2_thread_idx on public.thread_messages2 (thread_id);
create index if not exists thread_messages2_id_idx on public.thread_messages2 (id);
create index if not exists thread_messages2_created_at_idx on public.thread_messages2 (created_at);

-- Enable RLS on all tables
alter table public.profiles2 enable row level security;
alter table public.chat_messages2 enable row level security;
alter table public.listings2 enable row level security;
alter table public.threads2 enable row level security;
alter table public.thread_messages2 enable row level security;

-- profiles2
-- Read own profile; allow public read by username via server (admin), so we only need auth user access here
create policy "read own profile" on public.profiles2
  for select using (auth.uid() = id);

create policy "update own profile" on public.profiles2
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "insert own profile (on signup hook)" on public.profiles2
  for insert with check (auth.uid() = id);

-- chat_messages2
-- Public read (global chat)
create policy "chat read all" on public.chat_messages2
  for select using (true);

-- Insert only if logged in (username set by server function)
create policy "chat insert by user" on public.chat_messages2
  for insert with check (auth.uid() is not null);

-- listings2
-- Public read
create policy "listings read all" on public.listings2
  for select using (true);

-- Insert/update only by owner (server function uses service_role, but policy keeps data consistent)
create policy "listings insert by owner" on public.listings2
  for insert with check (auth.uid() = user_id);
create policy "listings update by owner" on public.listings2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "listings delete by owner" on public.listings2
  for delete using (auth.uid() = user_id);

-- threads2
-- Read: participant only
create policy "threads read by participant" on public.threads2
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Insert: must be one of the participants
create policy "threads insert by participant" on public.threads2
  for insert with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- thread_messages2
-- Read: participants of the parent thread
create policy "dm msgs read by participants" on public.thread_messages2
  for select using (
    exists (
      select 1 from public.threads2 t
      where t.id = thread_messages2.thread_id
        and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())
    )
  );

-- Insert: participants only
create policy "dm msgs insert by participants" on public.thread_messages2
  for insert with check (
    exists (
      select 1 from public.threads2 t
      where t.id = thread_messages2.thread_id
        and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())
    )
  );