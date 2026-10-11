-- "Connects to": the sources whose overall meaning sits closest to a given one.
--
-- Each source is represented by the centroid (mean) of its chunk embeddings and
-- compared by cosine similarity. Alongside each match comes the passage in that
-- source nearest the target's centroid, so the reader can see *why* it connects.
--
-- The centroids are computed on the fly from source_chunks. At a few thousand
-- chunks that is a cheap sequential pass; if the library grows past that,
-- precompute a centroid column on sources at embed time.
--
-- min_similarity was calibrated on the real library (2026-10-11): median pair
-- 0.30, p90 0.49; matches above ~0.45 read as genuinely related, below ~0.40
-- as noise. Showing nothing beats showing a weak link.

create or replace function public.related_sources(
  target_source_id uuid,
  match_count integer default 5,
  min_similarity double precision default 0.45
)
returns table (
  source_id uuid,
  title text,
  canonical_url text,
  author text,
  favicon_url text,
  thumbnail_url text,
  similarity double precision,
  passage text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select extensions.avg(chunks.embedding) as centroid
    from public.source_chunks as chunks
    where chunks.user_id = (select auth.uid())
      and chunks.source_id = target_source_id
  ),
  centroids as (
    select chunks.source_id, extensions.avg(chunks.embedding) as centroid
    from public.source_chunks as chunks
    where chunks.user_id = (select auth.uid())
      and chunks.source_id <> target_source_id
    group by chunks.source_id
  ),
  ranked as (
    select
      centroids.source_id,
      1 - (centroids.centroid operator(extensions.<=>) target.centroid) as similarity
    from centroids
    cross join target
    where target.centroid is not null
    order by centroids.centroid operator(extensions.<=>) target.centroid
    limit least(greatest(match_count, 1), 12)
  )
  select
    ranked.source_id,
    sources.title,
    sources.canonical_url,
    sources.author,
    sources.favicon_url,
    sources.thumbnail_url,
    ranked.similarity::double precision,
    (
      select left(chunks.text, 420)
      from public.source_chunks as chunks
      cross join target
      where chunks.user_id = (select auth.uid())
        and chunks.source_id = ranked.source_id
      order by chunks.embedding operator(extensions.<=>) target.centroid
      limit 1
    ) as passage
  from ranked
  join public.sources as sources
    on sources.id = ranked.source_id
    and sources.user_id = (select auth.uid())
  where ranked.similarity >= min_similarity
    and sources.status = 'ready'
  order by ranked.similarity desc;
$$;

revoke all on function public.related_sources(uuid, integer, double precision)
  from public, anon;
grant execute on function public.related_sources(uuid, integer, double precision)
  to authenticated;
