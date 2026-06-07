-- Shared Konstancia chats between SHKF users.

create table if not exists public.agent_chat_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Чат',
  owner_name text not null default '',
  owner_username text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint agent_chat_shares_not_self check (owner_id <> recipient_id)
);

create index if not exists agent_chat_shares_recipient_pending_idx
  on public.agent_chat_shares (recipient_id, created_at desc)
  where status = 'pending';

create index if not exists agent_chat_shares_owner_idx
  on public.agent_chat_shares (owner_id, created_at desc);

alter table public.agent_chat_shares enable row level security;

-- Any active SHKF user can pick colleagues for sharing.
drop policy if exists "profiles_select_active_colleagues" on public.profiles;
create policy "profiles_select_active_colleagues"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_active = true
  )
  and is_active = true
);

drop policy if exists "agent_chat_shares_select_participant" on public.agent_chat_shares;
create policy "agent_chat_shares_select_participant"
on public.agent_chat_shares for select
using (auth.uid() = owner_id or auth.uid() = recipient_id);

drop policy if exists "agent_chat_shares_insert_owner" on public.agent_chat_shares;
create policy "agent_chat_shares_insert_owner"
on public.agent_chat_shares for insert
with check (
  auth.uid() = owner_id
  and owner_id <> recipient_id
  and exists (
    select 1 from public.profiles r
    where r.id = recipient_id and r.is_active = true
  )
);

drop policy if exists "agent_chat_shares_update_recipient" on public.agent_chat_shares;
create policy "agent_chat_shares_update_recipient"
on public.agent_chat_shares for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);
