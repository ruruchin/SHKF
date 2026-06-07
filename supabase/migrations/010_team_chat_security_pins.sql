-- Fix profiles RLS recursion + team chat pins + DM message immutability + private attachments.

-- Non-recursive helpers (security definer bypasses RLS on profiles).
create or replace function public.shkf_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.shkf_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'designer'::public.app_role
  );
$$;

drop policy if exists "profiles_select_active_colleagues" on public.profiles;
create policy "profiles_select_active_colleagues"
on public.profiles for select
using (
  public.shkf_is_active_user()
  and is_active = true
);

drop policy if exists "pm_select_profiles" on public.profiles;
create policy "pm_select_profiles"
on public.profiles for select
using (
  public.shkf_is_active_user()
  and public.shkf_user_role() in ('pm', 'full')
);

drop policy if exists "releases_read_active_users" on public.app_releases;
create policy "releases_read_active_users"
on public.app_releases for select
using (public.shkf_is_active_user());

-- Team chat active check without recursion.
create or replace function public.team_chat_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.shkf_is_active_user();
$$;

-- Room pins (per user).
create table if not exists public.team_chat_room_pins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.team_chat_rooms(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

create index if not exists team_chat_room_pins_user_idx
  on public.team_chat_room_pins (user_id, pinned_at desc);

-- Pinned messages (visible to everyone in the room).
create table if not exists public.team_chat_pinned_messages (
  room_id uuid not null references public.team_chat_rooms(id) on delete cascade,
  message_id uuid not null references public.team_chat_messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (room_id, message_id)
);

create index if not exists team_chat_pinned_messages_room_idx
  on public.team_chat_pinned_messages (room_id, pinned_at desc);

alter table public.team_chat_room_pins enable row level security;
alter table public.team_chat_pinned_messages enable row level security;

drop policy if exists "team_chat_room_pins_select" on public.team_chat_room_pins;
create policy "team_chat_room_pins_select"
on public.team_chat_room_pins for select
using (auth.uid() = user_id);

drop policy if exists "team_chat_room_pins_insert" on public.team_chat_room_pins;
create policy "team_chat_room_pins_insert"
on public.team_chat_room_pins for insert
with check (
  auth.uid() = user_id
  and public.team_chat_can_access_room(room_id)
);

drop policy if exists "team_chat_room_pins_delete" on public.team_chat_room_pins;
create policy "team_chat_room_pins_delete"
on public.team_chat_room_pins for delete
using (auth.uid() = user_id);

drop policy if exists "team_chat_pinned_messages_select" on public.team_chat_pinned_messages;
create policy "team_chat_pinned_messages_select"
on public.team_chat_pinned_messages for select
using (public.team_chat_can_access_room(room_id));

drop policy if exists "team_chat_pinned_messages_insert" on public.team_chat_pinned_messages;
create policy "team_chat_pinned_messages_insert"
on public.team_chat_pinned_messages for insert
with check (
  auth.uid() = pinned_by
  and public.team_chat_can_access_room(room_id)
  and exists (
    select 1 from public.team_chat_messages m
    where m.id = message_id and m.room_id = room_id
  )
);

drop policy if exists "team_chat_pinned_messages_delete" on public.team_chat_pinned_messages;
create policy "team_chat_pinned_messages_delete"
on public.team_chat_pinned_messages for delete
using (
  auth.uid() = pinned_by
  and public.team_chat_can_access_room(room_id)
);

-- Messages are immutable: no update/delete policies (DM content cannot be moved or edited).
revoke update, delete on public.team_chat_messages from authenticated;

-- Private attachments scoped by room.
update storage.buckets set public = false where id = 'team-chat';

drop policy if exists "team_chat_storage_read" on storage.objects;
create policy "team_chat_storage_read"
on storage.objects for select
using (
  bucket_id = 'team-chat'
  and public.team_chat_can_access_room(
    (nullif((storage.foldername(name))[1], ''))::uuid
  )
);

drop policy if exists "team_chat_storage_insert" on storage.objects;
create policy "team_chat_storage_insert"
on storage.objects for insert
with check (
  bucket_id = 'team-chat'
  and auth.uid()::text = (storage.foldername(name))[2]
  and public.team_chat_can_access_room(
    (nullif((storage.foldername(name))[1], ''))::uuid
  )
);

drop policy if exists "team_chat_storage_delete" on storage.objects;
create policy "team_chat_storage_delete"
on storage.objects for delete
using (
  bucket_id = 'team-chat'
  and auth.uid()::text = (storage.foldername(name))[2]
);
