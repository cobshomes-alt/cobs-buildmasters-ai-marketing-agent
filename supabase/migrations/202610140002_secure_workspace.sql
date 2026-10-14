-- COBS Buildmasters secure owner workspace
-- Apply with Supabase CLI or SQL editor. This migration is safe to rerun.

create table if not exists public.cobs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create or replace function public.cobs_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cobs_profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create table if not exists public.cobs_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'Draft' check (status in ('Draft','Pending approval','Approved','Scheduled','Rejected')),
  source text not null default 'manual' check (source in ('ai','starter','manual')),
  created_by uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cobs_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cobs_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  source text,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cobs_media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text unique not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cobs_profiles enable row level security;
alter table public.cobs_posts enable row level security;
alter table public.cobs_campaigns enable row level security;
alter table public.cobs_leads enable row level security;
alter table public.cobs_media_assets enable row level security;

drop policy if exists "read own profile" on public.cobs_profiles;
create policy "read own profile" on public.cobs_profiles for select using (id = auth.uid());
drop policy if exists "owner manages posts" on public.cobs_posts;
create policy "owner manages posts" on public.cobs_posts for all using (public.cobs_is_owner()) with check (public.cobs_is_owner());
drop policy if exists "owner manages campaigns" on public.cobs_campaigns;
create policy "owner manages campaigns" on public.cobs_campaigns for all using (public.cobs_is_owner()) with check (public.cobs_is_owner());
drop policy if exists "owner manages leads" on public.cobs_leads;
create policy "owner manages leads" on public.cobs_leads for all using (public.cobs_is_owner()) with check (public.cobs_is_owner());
drop policy if exists "owner manages cobs media assets" on public.cobs_media_assets;
create policy "owner manages cobs media assets" on public.cobs_media_assets for all using (public.cobs_is_owner()) with check (public.cobs_is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cobs-media', 'cobs-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "owner manages cobs media objects" on storage.objects;
create policy "owner manages cobs media objects" on storage.objects for all using (bucket_id = 'cobs-media' and public.cobs_is_owner()) with check (bucket_id = 'cobs-media' and public.cobs_is_owner());

create or replace function public.cobs_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cobs_profiles (id, email, role)
  values (new.id, lower(new.email), case when lower(new.email) = 'cobshomes@gmail.com' then 'owner' else 'member' end)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists cobs_profile_after_signup on auth.users;
create trigger cobs_profile_after_signup after insert on auth.users
for each row execute procedure public.cobs_new_user_profile();

create or replace function public.cobs_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists cobs_posts_updated_at on public.cobs_posts;
create trigger cobs_posts_updated_at before update on public.cobs_posts
for each row execute procedure public.cobs_touch_updated_at();
