create extension if not exists vector;

create table if not exists public.design_references (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  title text not null,
  url text not null unique,
  platform text not null default '',
  surface text not null default '',
  tags text[] not null default '{}',
  quality smallint not null default 3 check (quality between 1 and 5),
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.design_reference_embeddings (
  reference_id uuid primary key references public.design_references(id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  updated_at timestamptz not null default now()
);

create index if not exists design_references_platform_idx
  on public.design_references (platform, surface);

create index if not exists design_references_tags_gin_idx
  on public.design_references using gin(tags);

create index if not exists design_reference_embeddings_ivfflat_idx
  on public.design_reference_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.design_references enable row level security;
alter table public.design_reference_embeddings enable row level security;

drop policy if exists "design_refs_read_active_users" on public.design_references;
create policy "design_refs_read_active_users"
on public.design_references for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);

drop policy if exists "design_refs_insert_pm_full" on public.design_references;
create policy "design_refs_insert_pm_full"
on public.design_references for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
);

drop policy if exists "design_refs_update_pm_full" on public.design_references;
create policy "design_refs_update_pm_full"
on public.design_references for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
);

drop policy if exists "design_refs_delete_pm_full" on public.design_references;
create policy "design_refs_delete_pm_full"
on public.design_references for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
);

drop policy if exists "design_ref_embeddings_read_active_users" on public.design_reference_embeddings;
create policy "design_ref_embeddings_read_active_users"
on public.design_reference_embeddings for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  )
);

drop policy if exists "design_ref_embeddings_write_pm_full" on public.design_reference_embeddings;
create policy "design_ref_embeddings_write_pm_full"
on public.design_reference_embeddings for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('pm', 'full')
      and p.is_active = true
  )
);
