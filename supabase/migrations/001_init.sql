create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('designer', 'frontend', 'backend', 'pm', 'full');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'designer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null default '',
  notes text not null default '',
  published_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'designer'::public.app_role)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, settings, app_state)
  values (new.id, '{}'::jsonb, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
exception
  when invalid_text_representation then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''), 'designer')
    on conflict (id) do nothing;
    insert into public.user_settings (user_id, settings, app_state)
    values (new.id, '{}'::jsonb, '{}'::jsonb)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.app_releases enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own_limited" on public.profiles;
create policy "profiles_update_own_limited"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "pm_select_profiles" on public.profiles;
create policy "pm_select_profiles"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
);

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own"
on public.user_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "releases_read_active_users" on public.app_releases;
create policy "releases_read_active_users"
on public.app_releases for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);
