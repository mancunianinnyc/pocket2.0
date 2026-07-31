-- Starring a source marks it for publication on rossgarlick.com/what-im-reading.
-- A timestamp rather than a boolean: it gives the public feed its ordering and
-- keeps a record of when something was picked.
alter table public.sources
  add column if not exists starred_at timestamptz,
  add column if not exists public_blurb text;

comment on column public.sources.starred_at is
  'Non-null means this source is published publicly. Also the public feed ordering.';
comment on column public.sources.public_blurb is
  'One-line summary written for the public page. Generated on star, editable by the owner.';

-- The public feed reads starred rows only, newest first.
create index if not exists sources_starred_idx
  on public.sources (starred_at desc)
  where starred_at is not null;

-- No RLS changes: existing per-user policies still govern every authenticated
-- read and write. The public feed is served by the app's own route using the
-- service role, which filters to starred_at is not null and selects an explicit
-- column list — extracted_text is never exposed.
