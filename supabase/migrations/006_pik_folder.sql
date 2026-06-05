-- PIK-FOLDER: визуальная галерея референсов для дизайнеров (Savee-style)

create table if not exists public.pik_folder_items (
  id text primary key,
  source text not null default 'manual' check (source in ('mobbin', 'pinterest', 'manual', 'savee')),
  title text not null default '',
  image_url text not null,
  thumb_url text,
  external_url text not null default '',
  topic text not null default 'all',
  tags text[] not null default '{}',
  width int not null default 400 check (width > 0),
  height int not null default 500 check (height > 0),
  is_video boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pik_folder_items_topic_idx on public.pik_folder_items (topic, sort_order desc);
create index if not exists pik_folder_items_tags_gin_idx on public.pik_folder_items using gin (tags);
create index if not exists pik_folder_items_source_idx on public.pik_folder_items (source);

alter table public.pik_folder_items enable row level security;

drop policy if exists "pik_folder_read_designers" on public.pik_folder_items;
create policy "pik_folder_read_designers"
on public.pik_folder_items for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('designer', 'pm', 'full')
  )
);

drop policy if exists "pik_folder_write_pm_full" on public.pik_folder_items;
create policy "pik_folder_write_pm_full"
on public.pik_folder_items for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('pm', 'full')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('pm', 'full')
  )
);
