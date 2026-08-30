-- Videos carry a real poster image; store it so cards and the reader can show
-- the actual thumbnail instead of a favicon monogram.
alter table public.sources
  add column if not exists thumbnail_url text;

comment on column public.sources.thumbnail_url is
  'Absolute URL of the source''s poster image (e.g. YouTube thumbnail), resolved at extraction time.';
