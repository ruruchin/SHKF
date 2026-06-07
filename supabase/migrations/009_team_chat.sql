-- Team chat between SHKF employees: general channel, DMs, task threads.

create table if not exists public.team_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('general', 'dm', 'task')),
  title text not null default '',
  task_id integer,
  dm_low uuid references public.profiles(id) on delete cascade,
  dm_high uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_chat_dm_pair check (
    kind <> 'dm'
    or (dm_low is not null and dm_high is not null and dm_low <> dm_high and dm_low < dm_high)
  ),
  constraint team_chat_task_room check (
    kind <> 'task' or task_id is not null
  )
);

create unique index if not exists team_chat_dm_unique_idx
  on public.team_chat_rooms (dm_low, dm_high)
  where kind = 'dm';

create unique index if not exists team_chat_task_unique_idx
  on public.team_chat_rooms (task_id)
  where kind = 'task';

create unique index if not exists team_chat_general_unique_idx
  on public.team_chat_rooms (kind)
  where kind = 'general';

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.team_chat_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  task_ids integer[] not null default '{}',
  mention_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists team_chat_messages_room_created_idx
  on public.team_chat_messages (room_id, created_at desc);

create table if not exists public.team_chat_reads (
  room_id uuid not null references public.team_chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create or replace function public.team_chat_touch_room()
returns trigger
language plpgsql
as $$
begin
  update public.team_chat_rooms
  set updated_at = now()
  where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists team_chat_messages_touch_room on public.team_chat_messages;
create trigger team_chat_messages_touch_room
after insert on public.team_chat_messages
for each row execute function public.team_chat_touch_room();

insert into public.team_chat_rooms (id, kind, title)
values ('00000000-0000-4000-8000-000000000001', 'general', 'Общий')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-chat', 'team-chat', true)
on conflict (id) do update set public = true;

alter table public.team_chat_rooms enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reads enable row level security;

create or replace function public.team_chat_is_active_user()
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

create or replace function public.team_chat_can_access_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_chat_rooms r
    where r.id = target_room_id
      and public.team_chat_is_active_user()
      and (
        r.kind in ('general', 'task')
        or (r.kind = 'dm' and auth.uid() in (r.dm_low, r.dm_high))
      )
  );
$$;

drop policy if exists "team_chat_rooms_select" on public.team_chat_rooms;
create policy "team_chat_rooms_select"
on public.team_chat_rooms for select
using (
  public.team_chat_is_active_user()
  and (
    kind in ('general', 'task')
    or (kind = 'dm' and auth.uid() in (dm_low, dm_high))
  )
);

drop policy if exists "team_chat_rooms_insert" on public.team_chat_rooms;
create policy "team_chat_rooms_insert"
on public.team_chat_rooms for insert
with check (
  public.team_chat_is_active_user()
  and (
    (kind = 'general' and false)
    or (kind = 'task' and task_id is not null)
    or (kind = 'dm' and auth.uid() in (dm_low, dm_high))
  )
);

drop policy if exists "team_chat_messages_select" on public.team_chat_messages;
create policy "team_chat_messages_select"
on public.team_chat_messages for select
using (public.team_chat_can_access_room(room_id));

drop policy if exists "team_chat_messages_insert" on public.team_chat_messages;
create policy "team_chat_messages_insert"
on public.team_chat_messages for insert
with check (
  auth.uid() = author_id
  and public.team_chat_can_access_room(room_id)
);

drop policy if exists "team_chat_reads_select" on public.team_chat_reads;
create policy "team_chat_reads_select"
on public.team_chat_reads for select
using (auth.uid() = user_id);

drop policy if exists "team_chat_reads_upsert" on public.team_chat_reads;
create policy "team_chat_reads_upsert"
on public.team_chat_reads for insert
with check (auth.uid() = user_id);

drop policy if exists "team_chat_reads_update" on public.team_chat_reads;
create policy "team_chat_reads_update"
on public.team_chat_reads for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "team_chat_storage_read" on storage.objects;
create policy "team_chat_storage_read"
on storage.objects for select
using (bucket_id = 'team-chat');

drop policy if exists "team_chat_storage_insert" on storage.objects;
create policy "team_chat_storage_insert"
on storage.objects for insert
with check (
  bucket_id = 'team-chat'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "team_chat_storage_delete" on storage.objects;
create policy "team_chat_storage_delete"
on storage.objects for delete
using (
  bucket_id = 'team-chat'
  and auth.uid()::text = (storage.foldername(name))[1]
);
