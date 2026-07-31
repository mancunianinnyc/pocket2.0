-- Cards show the site's own favicon; store where it lives so the browser can
-- load it directly from the origin rather than through an icon service.
alter table public.sources
  add column if not exists favicon_url text;

comment on column public.sources.favicon_url is
  'Absolute URL of the site favicon, resolved at extraction time.';
