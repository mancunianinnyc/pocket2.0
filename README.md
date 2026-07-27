# Personal Library

A mobile-first personal knowledge library: save a URL quickly, keep a readable
copy, enrich it with structured metadata, retrieve it with hybrid search, and
ask questions that cite exact saved passages.

## What is implemented

- Magic-link authentication with a Ross-only allowlist in the first migration.
- URL capture with redirect-by-redirect SSRF protection, a 15-second fetch
  timeout, a 5 MB cap, Readability extraction, and explicit failure states.
- Claude structured enrichment and evidence-constrained Q&A.
- OpenAI `text-embedding-3-small` embeddings (1,536 dimensions).
- PostgreSQL FTS + pgvector HNSW search, blended with reciprocal-rank fusion.
- Responsive Library and Reader screens.
- PWA manifest, service worker, Android Web Share Target, auto-save handoff, and
  desktop bookmarklet.
- Hashed, revocable, show-once capture tokens and a `POST /api/capture` endpoint
  for iOS Shortcuts.
- RLS and ownership-preserving composite foreign keys from migration 001.
- Per-user database-backed rate limits for capture and Ask.

## Prerequisites

- Node 24.14.0
- pnpm 11.9.0
- A new Supabase project with pgvector available
- Anthropic and OpenAI API keys

## Local setup

```powershell
Copy-Item .env.example .env.local
pnpm install
pnpm dev
```

Fill `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_DATABASE_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
APP_BASE_URL=http://localhost:3000
```

Use a modern Supabase publishable key (`sb_publishable_...`) for
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never expose the service-role key.
Legacy projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.

## Database

Link the CLI to the new project, then apply the migration:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase migration list
supabase db advisors
```

Migration 001 seeds `rossgarlick@gmail.com` into `private.allowed_emails`. Add
friends there only when signups should open.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

After applying the migration, also verify:

1. Ross can sign in by magic link.
2. A second, non-allowlisted email cannot create an account.
3. Saving a URL reaches `ready` or a clear `failed` state.
4. The saved item appears in exact and conceptual search.
5. Ask responses link to saved sources and refuse unsupported questions.
6. Deleting a source removes its metadata and chunks.
7. A second invited test account cannot read Ross’s rows.

## Capture

The Android PWA registers as a Web Share Target. For iOS, follow
[`docs/ios-shortcut.md`](docs/ios-shortcut.md).

Token capture example:

```bash
curl -X POST https://YOUR-DOMAIN/api/capture \
  -H "Authorization: Bearer pl_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

## Deployment

Set all environment variables in Vercel for Production, Preview, and
Development as appropriate. Set production `APP_BASE_URL` to the canonical
HTTPS domain, then connect the GitHub `main` branch for automatic deployments.
