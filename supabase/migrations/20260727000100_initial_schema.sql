begin;

create schema if not exists extensions;
create schema if not exists private;

create extension if not exists vector with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx
  on public.profiles (lower(email));

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('url', 'pdf', 'note')),
  title text,
  canonical_url text,
  original_file_path text,
  extracted_text text,
  author text,
  published_at timestamptz,
  saved_at timestamptz not null default now(),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'failed')),
  processing_error text,
  content_hash text not null,
  why_saved text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index sources_user_content_hash_idx
  on public.sources (user_id, content_hash);
create index sources_user_saved_at_idx
  on public.sources (user_id, saved_at desc);
create index sources_user_status_idx
  on public.sources (user_id, status);

create table public.source_metadata (
  source_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text,
  key_claims jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  content_type text,
  reading_time_minutes integer check (reading_time_minutes is null or reading_time_minutes >= 0),
  warnings jsonb not null default '[]'::jsonb,
  model_name text,
  created_at timestamptz not null default now(),
  foreign key (source_id, user_id)
    references public.sources(id, user_id) on delete cascade
);

create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset >= start_offset),
  embedding extensions.vector(1536) not null,
  fts tsvector generated always as (to_tsvector('english', text)) stored,
  created_at timestamptz not null default now(),
  foreign key (source_id, user_id)
    references public.sources(id, user_id) on delete cascade,
  unique (source_id, chunk_index)
);

create index source_chunks_embedding_hnsw_idx
  on public.source_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index source_chunks_fts_idx
  on public.source_chunks using gin (fts);
create index source_chunks_user_source_idx
  on public.source_chunks (user_id, source_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid,
  body text not null,
  note_type text not null check (note_type in ('personal_note', 'why_saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_id, user_id)
    references public.sources(id, user_id) on delete cascade
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null,
  quoted_text text not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset >= start_offset),
  comment text,
  created_at timestamptz not null default now(),
  foreign key (source_id, user_id)
    references public.sources(id, user_id) on delete cascade
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.source_projects (
  source_id uuid not null,
  project_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_id, project_id),
  foreign key (source_id, user_id)
    references public.sources(id, user_id) on delete cascade,
  foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

create table public.saved_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  answer text,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  label text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count >= 0),
  primary key (user_id, action, window_start)
);

create or replace function public.consume_rate_limit(
  target_user_id uuid,
  target_action text,
  allowed_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  next_count integer;
begin
  if target_user_id is null
    or target_action is null
    or allowed_requests < 1
    or window_seconds < 1
  then
    raise exception 'Invalid rate-limit input.';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds) * window_seconds
  );

  insert into public.rate_limits (
    user_id,
    action,
    window_start,
    request_count
  )
  values (target_user_id, target_action, bucket_start, 1)
  on conflict (user_id, action, window_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into next_count;

  delete from public.rate_limits
  where window_start < now() - interval '2 days';

  return next_count <= allowed_requests;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer)
  to service_role;

create table private.allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into private.allowed_emails (email)
values ('rossgarlick@gmail.com')
on conflict do nothing;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1
    from private.allowed_emails
    where email = lower(new.email)
  ) then
    raise exception 'This email is not currently invited.';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function private.set_updated_at();

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.source_metadata enable row level security;
alter table public.source_chunks enable row level security;
alter table public.notes enable row level security;
alter table public.highlights enable row level security;
alter table public.projects enable row level security;
alter table public.source_projects enable row level security;
alter table public.saved_queries enable row level security;
alter table public.capture_tokens enable row level security;
alter table public.rate_limits enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "sources_select_own"
  on public.sources for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "sources_insert_own"
  on public.sources for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "sources_update_own"
  on public.sources for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sources_delete_own"
  on public.sources for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "source_metadata_select_own"
  on public.source_metadata for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "source_metadata_insert_own"
  on public.source_metadata for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "source_metadata_update_own"
  on public.source_metadata for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "source_metadata_delete_own"
  on public.source_metadata for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "source_chunks_select_own"
  on public.source_chunks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "source_chunks_insert_own"
  on public.source_chunks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "source_chunks_update_own"
  on public.source_chunks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "source_chunks_delete_own"
  on public.source_chunks for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "notes_select_own"
  on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notes_insert_own"
  on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "notes_update_own"
  on public.notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes_delete_own"
  on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "highlights_select_own"
  on public.highlights for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "highlights_insert_own"
  on public.highlights for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "highlights_update_own"
  on public.highlights for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "highlights_delete_own"
  on public.highlights for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects_select_own"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "projects_update_own"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "projects_delete_own"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "source_projects_select_own"
  on public.source_projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "source_projects_insert_own"
  on public.source_projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "source_projects_delete_own"
  on public.source_projects for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_queries_select_own"
  on public.saved_queries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "saved_queries_insert_own"
  on public.saved_queries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "saved_queries_update_own"
  on public.saved_queries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "saved_queries_delete_own"
  on public.saved_queries for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "capture_tokens_select_own"
  on public.capture_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "capture_tokens_insert_own"
  on public.capture_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "capture_tokens_update_own"
  on public.capture_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "capture_tokens_delete_own"
  on public.capture_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles,
     public.sources,
     public.source_metadata,
     public.source_chunks,
     public.notes,
     public.highlights,
     public.projects,
     public.source_projects,
     public.saved_queries,
     public.capture_tokens
  to authenticated;

revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(1536),
  match_count integer default 24,
  filter_project_id uuid default null
)
returns table (
  source_id uuid,
  chunk_index integer,
  chunk_text text,
  title text,
  canonical_url text,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with full_text as (
    select
      chunks.id,
      row_number() over (
        order by ts_rank_cd(chunks.fts, websearch_to_tsquery('english', query_text)) desc
      ) as rank
    from public.source_chunks as chunks
    where chunks.user_id = (select auth.uid())
      and chunks.fts @@ websearch_to_tsquery('english', query_text)
      and (
        filter_project_id is null
        or exists (
          select 1
          from public.source_projects as source_project
          where source_project.source_id = chunks.source_id
            and source_project.user_id = chunks.user_id
            and source_project.project_id = filter_project_id
        )
      )
    order by rank
    limit least(greatest(match_count * 3, 24), 100)
  ),
  semantic as (
    select
      chunks.id,
      row_number() over (
        order by chunks.embedding <=> query_embedding
      ) as rank
    from public.source_chunks as chunks
    where chunks.user_id = (select auth.uid())
      and (
        filter_project_id is null
        or exists (
          select 1
          from public.source_projects as source_project
          where source_project.source_id = chunks.source_id
            and source_project.user_id = chunks.user_id
            and source_project.project_id = filter_project_id
        )
      )
    order by chunks.embedding <=> query_embedding
    limit least(greatest(match_count * 3, 24), 100)
  ),
  fused as (
    select
      coalesce(full_text.id, semantic.id) as id,
      coalesce(1.0 / (60 + full_text.rank), 0.0)
        + coalesce(1.0 / (60 + semantic.rank), 0.0) as score
    from full_text
    full outer join semantic on full_text.id = semantic.id
  )
  select
    chunks.source_id,
    chunks.chunk_index,
    chunks.text as chunk_text,
    sources.title,
    sources.canonical_url,
    fused.score::double precision
  from fused
  join public.source_chunks as chunks on chunks.id = fused.id
  join public.sources as sources
    on sources.id = chunks.source_id
    and sources.user_id = chunks.user_id
  where chunks.user_id = (select auth.uid())
  order by fused.score desc
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.hybrid_search(text, extensions.vector, integer, uuid)
  from public, anon;
grant execute on function public.hybrid_search(text, extensions.vector, integer, uuid)
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('sources', 'sources', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

commit;
