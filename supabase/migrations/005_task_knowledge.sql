create extension if not exists vector;

create table if not exists public.task_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  issue_id integer,
  project text not null default '',
  chunk_type text not null default 'summary',
  body text not null,
  tags text[] not null default '{}',
  deliverable text not null default 'unknown',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_knowledge_embeddings (
  chunk_id uuid primary key references public.task_knowledge_chunks(id) on delete cascade,
  model text not null default 'Embeddings',
  embedding vector(1536) not null,
  updated_at timestamptz not null default now()
);

create index if not exists task_knowledge_chunks_project_idx
  on public.task_knowledge_chunks (project, chunk_type);

create index if not exists task_knowledge_embeddings_ivfflat_idx
  on public.task_knowledge_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.task_knowledge_chunks enable row level security;
alter table public.task_knowledge_embeddings enable row level security;

drop policy if exists "task_knowledge_read_active" on public.task_knowledge_chunks;
create policy "task_knowledge_read_active"
on public.task_knowledge_chunks for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "task_knowledge_insert_own" on public.task_knowledge_chunks;
create policy "task_knowledge_insert_own"
on public.task_knowledge_chunks for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "task_knowledge_emb_read" on public.task_knowledge_embeddings;
create policy "task_knowledge_emb_read"
on public.task_knowledge_embeddings for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "task_knowledge_emb_insert" on public.task_knowledge_embeddings;
create policy "task_knowledge_emb_insert"
on public.task_knowledge_embeddings for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

create or replace function public.match_task_knowledge(
  query_embedding_text text,
  match_count int default 5
)
returns table (
  id uuid,
  issue_id integer,
  project text,
  chunk_type text,
  body text,
  tags text[],
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
declare
  q vector(1536);
begin
  q := query_embedding_text::vector;
  return query
  select
    c.id,
    c.issue_id,
    c.project,
    c.chunk_type,
    c.body,
    c.tags,
    1 - (e.embedding <=> q) as similarity
  from public.task_knowledge_embeddings e
  join public.task_knowledge_chunks c on c.id = e.chunk_id
  where exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
  order by e.embedding <=> q
  limit greatest(1, least(match_count, 20));
end;
$$;

grant execute on function public.match_task_knowledge(text, int) to authenticated;
