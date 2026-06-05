-- PIK-FOLDER: платформа и тип экрана для фильтров

alter table public.pik_folder_items
  add column if not exists platform text not null default 'web',
  add column if not exists screen_type text not null default 'product',
  add column if not exists query text not null default '';

create index if not exists pik_folder_items_platform_idx
  on public.pik_folder_items (platform, topic, sort_order desc);

create index if not exists pik_folder_items_screen_type_idx
  on public.pik_folder_items (screen_type, sort_order desc);
