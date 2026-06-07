-- Forward metadata for team chat messages.

alter table public.team_chat_messages
  add column if not exists meta jsonb not null default '{}'::jsonb;

drop function if exists public.team_chat_list_room_messages(uuid, int);

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
  meta jsonb,
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
    select m.id, m.room_id, m.author_id, m.body, m.task_ids, m.mention_ids, m.meta, m.created_at, m.attachments as legacy_attachments
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
    coalesce(l.meta, '{}'::jsonb) as meta,
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
