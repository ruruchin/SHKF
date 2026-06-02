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

create or replace function public.match_design_references(
  query_embedding_text text,
  match_count int default 6
)
returns table (
  id uuid,
  source text,
  title text,
  url text,
  platform text,
  surface text,
  tags text[],
  quality smallint,
  note text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dr.id,
    dr.source,
    dr.title,
    dr.url,
    dr.platform,
    dr.surface,
    dr.tags,
    dr.quality,
    dr.note,
    1 - (dre.embedding <=> (query_embedding_text::vector(1536))) as similarity
  from public.design_reference_embeddings dre
  join public.design_references dr on dr.id = dre.reference_id
  order by dre.embedding <=> (query_embedding_text::vector(1536))
  limit greatest(1, least(coalesce(match_count, 6), 20));
$$;

grant execute on function public.match_design_references(text, int) to authenticated;

create or replace function public.upsert_design_reference_embedding(
  p_reference_id uuid,
  p_model text,
  p_embedding_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.design_reference_embeddings(reference_id, model, embedding, updated_at)
  values (
    p_reference_id,
    coalesce(nullif(p_model, ''), 'unknown'),
    p_embedding_text::vector(1536),
    now()
  )
  on conflict (reference_id)
  do update set
    model = excluded.model,
    embedding = excluded.embedding,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_design_reference_embedding(uuid, text, text) to authenticated;
