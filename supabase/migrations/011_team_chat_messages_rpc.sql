-- Fast single-query message load + normalized attachments.

create table if not exists public.team_chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.team_chat_messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0 check (byte_size >= 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (message_id, sort_order)
);

create index if not exists team_chat_message_attachments_message_idx
  on public.team_chat_message_attachments (message_id, sort_order);

insert into public.team_chat_message_attachments (
  message_id, storage_path, file_name, mime_type, byte_size, sort_order
)
select
  m.id,
  coalesce(elem->>'path', ''),
  coalesce(nullif(trim(elem->>'name'), ''), 'file'),
  coalesce(nullif(trim(elem->>'mime'), ''), 'application/octet-stream'),
  coalesce(nullif(elem->>'size', '')::bigint, 0),
  (ord - 1)::smallint
from public.team_chat_messages m
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(m.attachments) = 'array' then m.attachments else '[]'::jsonb end
) with ordinality as t(elem, ord)
where coalesce(elem->>'path', '') <> ''
on conflict (message_id, sort_order) do nothing;

alter table public.team_chat_message_attachments enable row level security;

drop policy if exists "team_chat_attachments_select" on public.team_chat_message_attachments;
create policy "team_chat_attachments_select"
on public.team_chat_message_attachments for select
using (
  exists (
    select 1
    from public.team_chat_messages msg
    where msg.id = message_id
      and public.team_chat_can_access_room(msg.room_id)
  )
);

drop policy if exists "team_chat_attachments_insert" on public.team_chat_message_attachments;
create policy "team_chat_attachments_insert"
on public.team_chat_message_attachments for insert
with check (
  exists (
    select 1
    from public.team_chat_messages msg
    where msg.id = message_id
      and msg.author_id = auth.uid()
      and public.team_chat_can_access_room(msg.room_id)
  )
);

create or replace function public.team_chat_list_room_messages(
  p_room_id uuid,
  p_limit int default 60
)
returns table (
  id uuid,
  room_id uuid,
  author_id uuid,
  body text,
  task_ids integer[],
  mention_ids uuid[],
  created_at timestamptz,
  pinned boolean,
  author jsonb,
  attachments jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with lim as (
    select m.id, m.room_id, m.author_id, m.body, m.task_ids, m.mention_ids, m.created_at, m.attachments as legacy_attachments
    from public.team_chat_messages m
    where m.room_id = p_room_id
      and public.team_chat_can_access_room(p_room_id)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 100))
  )
  select
    l.id,
    l.room_id,
    l.author_id,
    l.body,
    l.task_ids,
    l.mention_ids,
    l.created_at,
    exists (
      select 1
      from public.team_chat_pinned_messages pin
      where pin.message_id = l.id and pin.room_id = p_room_id
    ) as pinned,
    jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'username', p.username,
      'position', p.position,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'is_active', p.is_active
    ) as author,
    case
      when exists (select 1 from public.team_chat_message_attachments a where a.message_id = l.id) then
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'name', a.file_name,
              'path', a.storage_path,
              'mime', a.mime_type,
              'size', a.byte_size
            )
            order by a.sort_order
          )
          from public.team_chat_message_attachments a
          where a.message_id = l.id
        ), '[]'::jsonb)
      when jsonb_typeof(l.legacy_attachments) = 'array' and jsonb_array_length(l.legacy_attachments) > 0 then
        l.legacy_attachments
      else '[]'::jsonb
    end as attachments
  from lim l
  left join public.profiles p on p.id = l.author_id
  order by l.created_at asc;
$$;

revoke all on function public.team_chat_list_room_messages(uuid, int) from public;
grant execute on function public.team_chat_list_room_messages(uuid, int) to authenticated;
