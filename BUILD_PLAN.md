# Personal Library — Build Plan (v1)

**Status:** Approved for build. Decisions below are settled — do not relitigate them; build.
**Date:** 2026-07-27
**Owner:** Ross Garlick (rossgarlick@gmail.com)
**Origin:** Distilled from `~/Downloads/evernote-meets-pocket-build-brief.md` plus a planning session that made it mobile-first and cut scope. This file is self-contained — a fresh session should be able to execute it top to bottom.

---

## 1. Mission

A calm personal knowledge library: **save anything in <15 seconds from a phone; recover the useful idea whenever needed.** Pocket-style frictionless capture + Evernote-style durable storage + AI for summarization, semantic search, and cited Q&A across the library ("Ask my library").

Built for one user (Ross) first, but **multi-tenant from day 1** so it can be shared with friends later by simply opening signups — not a business, a shareable product.

## 2. Decisions already made (do not reopen)

1. **Stack:** Next.js (App Router, TypeScript) on **Vercel** + **Supabase** (Postgres + pgvector, Auth, Storage, RLS). Same stack family as Ross's Coliseo project, deliberately.
2. **Mobile-first capture, not desktop-first.** The original brief's Chrome extension is CUT from v1. In its place: PWA + Web Share Target (Android), an iOS-Shortcut-friendly token API endpoint, and a desktop bookmarklet.
3. **All state lives in Supabase, never in Vercel** — keeps hosting portable.
4. **RLS policies ship in the very first migration**, not retrofitted. `user_id` on every user-owned table. This is the entire "scale to friends" strategy.
5. **Processing is inline, not queued.** One API route does extract → enrich → chunk → embed with `maxDuration: 300` (Fluid compute makes idle LLM-wait cheap). Status states (`queued/processing/ready/failed`) + a retry button stand in for a job queue. A real queue is a later upgrade, only if usage fans out.
6. **CUT from v1:** weekly digest email, Chrome extension, voice/image/screenshot sources, OCR, collections-based digests, export. (Schema leaves room; features deferred.)
7. **AI vendors:** Claude API for enrichment + Ask-my-library. Embeddings via **OpenAI `text-embedding-3-small`** (1536 dims) — the Claude API has no embeddings endpoint.

## 3. Machine / environment specifics (Ross's dev box)

- Windows 11, PowerShell primary shell. Node via **fnm** (run `fnm env --use-on-cd | Out-String | Invoke-Expression` if node isn't found; check `.nvmrc`/`.node-version` conventions from the Coliseo project).
- **Never create the project under OneDrive-synced folders.** Workspace root is `C:\Users\rossg\Claude Workspace\` — build in `C:\Users\rossg\Claude Workspace\personal-library\` (this file's directory).
- Supabase: connect via the **pooler connection string** (port 6543) for app runtime; direct connection (5432) for migrations. Ross has an existing Supabase account; this project needs a **new Supabase project** (see §4).
- GitHub: Ross's account is `mancunianinnyc`; a PAT is configured on this machine (see the `convictionelo-dev-environment` memory if available). Commits should be authored as mancunianinnyc.
- Deploy: push to GitHub `main` → Vercel auto-deploys. Use `vercel` CLI / the vercel:* skills for linking and env vars.
- Practice: **keep git tags current** — tag versions (v0.1.0 etc.) and give a version summary at each milestone/cleanup point.
- Building agent: **load the `claude-api` skill before writing any Claude API code** — do not code the API from memory.

## 4. Human setup tasks (ask Ross to do these first, agent cannot)

1. Create a new Supabase project (name: `personal-library`). Provide: project URL, anon key, service-role key, DB password.
2. Provide/confirm an Anthropic API key and an OpenAI API key (embeddings only) as env vars.
3. Create the GitHub repo (`personal-library`, private) or authorize the agent to create it via `gh`.
4. Link the repo to a new Vercel project (or let the agent do it via `vercel link` and confirm).

Required env vars (`.env.local`, then mirrored to Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never exposed to client
DATABASE_URL=                    # pooler (6543) for runtime
DIRECT_DATABASE_URL=             # direct (5432) for migrations
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                  # embeddings only
APP_BASE_URL=                    # http://localhost:3000 locally
```

## 5. Build phases

### Phase 1 — Vertical slice (target: working end-to-end before anything else)

Auth → save a URL → extraction → enrichment → library list → reader view. One thing working beats five scaffolds.

1. Scaffold Next.js (App Router, TS, Tailwind, `src/` layout). Mobile-first responsive from the first component — this app is used primarily on a phone.
2. Supabase client setup (`@supabase/ssr` pattern: browser client, server client, middleware session refresh).
3. Migration 001: full schema **including RLS policies** (§6) + pgvector + FTS. Apply via Supabase CLI (`supabase db push` or `migration up` against `DIRECT_DATABASE_URL`).
4. Auth: magic-link email login (Google OAuth optional later). Signup gated by an `allowed_emails` check or Supabase's "disable signups" + manual invite — Ross-only for now, friends later by flipping the gate.
5. `POST /api/sources` — save a URL (dedupe by `content_hash` of canonical URL per user), insert with `status: 'queued'`, then run the processing pipeline inline (§8): extract → enrich → chunk → embed → `status: 'ready'` (or `'failed'` + `processing_error`).
6. Library screen: reverse-chron list of sources (title, domain, summary snippet, status chip, topics). Tap → Reader.
7. Reader screen: extracted content, metadata panel (summary, key claims, topics, entities), link to original, delete (cascades — §9), retry button when `failed`.

**Slice-1 done test:** on a phone browser, log in, paste a URL, watch it become a readable, summarized library item.

### Phase 2 — Capture everywhere (the mobile-first payoff)

1. **PWA:** `manifest.json` + service worker + **Web Share Target** (`share_target` accepting `url`/`text`/`title` via POST) → Android share sheet works after "Add to Home Screen".
2. **Capture tokens + `POST /api/capture`:** per-user long-lived token (stored **hashed**, shown once at creation, revocable in settings). Endpoint accepts `Authorization: Bearer <token>` + `{ url, note? }`, returns 202 immediately, processes inline after responding (or accepts the inline wait — either is fine at this scale).
3. **iOS Shortcut recipe:** write `docs/ios-shortcut.md` — a Shortcut that receives a Share-Sheet URL and POSTs it to `/api/capture` with the token. Walk Ross through creating it (2 min, one time).
4. **Bookmarklet** for desktop: `javascript:` snippet that opens `/save?url=...` prefilled. Show it in settings.
5. Quick-save UX: after capture, fire-and-forget. Never make the user wait or choose a project before saving. Organize later.

### Phase 3 — Retrieval (search + Ask my library)

1. **Hybrid search** `GET /api/search?q=`: Postgres FTS (tsvector, `websearch_to_tsquery`) + pgvector cosine over `source_chunks` + metadata filters (project, type, date), blended with reciprocal-rank fusion in a SQL function. Search screen with instant results.
2. **`POST /api/ask`:** rewrite question → hybrid retrieve top ~24 chunks (user-scoped — RLS enforces this, but also filter explicitly) → rerank/trim to ~8 → Claude answers **constrained to the evidence**, structured output with citations `{source_id, quote, chunk_index}` and an `insufficient_evidence` boolean. UI renders citations as links that open the Reader scrolled to the passage. When evidence is weak, say "I don't have enough evidence" — never invent.
3. Ask screen with question history (persist to `saved_queries`).

### Phase 4 — Personal layer + polish

1. Highlights (select text in Reader → save with offsets), notes, "why I saved this" field.
2. Projects: create, assign sources (many-to-many), filter library/search/ask by project.
3. PDF upload → Supabase Storage (private bucket, signed URLs) → text extraction (`pdf-parse` or `unpdf`) → same pipeline. Validate content-type + size (≤25MB). Skip OCR for image-based PDFs — mark `failed` with a clear warning.
4. Settings: capture tokens, bookmarklet, invite gate toggle, account deletion.
5. Deploy to Vercel, tag `v0.1.0`, load Ross's real backlog of saved items as the first product test.

## 6. Database schema (migration 001)

Enable: `create extension if not exists vector;`

`profiles` (mirrors `auth.users`, created by trigger): `id uuid pk references auth.users`, `email`, `display_name`, `created_at`.

`sources`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references profiles(id) on delete cascade`, `source_type text check (in 'url','pdf','note')`, `title`, `canonical_url`, `original_file_path`, `extracted_text`, `author`, `published_at`, `saved_at default now()`, `status text check (in 'queued','processing','ready','failed') default 'queued'`, `processing_error`, `content_hash text`, `why_saved text`, `created_at`, `updated_at`. Unique index on `(user_id, content_hash)` for dedupe.

`source_metadata`: `source_id uuid pk references sources on delete cascade`, `user_id uuid not null`, `summary text`, `key_claims jsonb`, `topics jsonb`, `entities jsonb`, `content_type text`, `reading_time_minutes int`, `warnings jsonb`, `model_name text`, `created_at`.

`source_chunks`: `id uuid pk`, `source_id references sources on delete cascade`, `user_id uuid not null`, `chunk_index int`, `text text`, `start_offset int`, `end_offset int`, `embedding vector(1536)`, `fts tsvector generated always as (to_tsvector('english', text)) stored`, `created_at`. Indexes: HNSW on `embedding` (`vector_cosine_ops`), GIN on `fts`.

`notes`: `id`, `user_id`, `source_id nullable references sources on delete cascade`, `body`, `note_type check (in 'personal_note','why_saved')`, timestamps.

`highlights`: `id`, `user_id`, `source_id references sources on delete cascade`, `quoted_text`, `start_offset`, `end_offset`, `comment`, `created_at`.

`projects`: `id`, `user_id`, `name`, `description`, `created_at`.
`source_projects`: `source_id references sources on delete cascade`, `project_id references projects on delete cascade`, pk (source_id, project_id).

`saved_queries`: `id`, `user_id`, `question`, `answer`, `citations jsonb`, `created_at`.

`capture_tokens`: `id`, `user_id`, `token_hash text` (sha-256), `label`, `last_used_at`, `created_at`, `revoked_at nullable`.

**RLS (in the same migration):** enable RLS on every table above; policy on each: `using (user_id = auth.uid()) with check (user_id = auth.uid())` for all of select/insert/update/delete (profiles: `id = auth.uid()`). Service-role key bypasses RLS for the capture endpoint + pipeline; those code paths must always filter by the resolved `user_id` explicitly. Storage bucket `sources` is private; access only via short-lived signed URLs generated server-side.

## 7. API surface (v1)

```
POST   /api/sources             create (url | note | pdf upload)
GET    /api/sources             list (filters: status, project, type, q)
GET    /api/sources/:id         detail (+metadata, +highlights, +notes)
PATCH  /api/sources/:id         edit why_saved / title / projects
DELETE /api/sources/:id         delete + cascade (see §9)
POST   /api/sources/:id/retry   re-run pipeline
POST   /api/capture             token-auth quick capture (share sheet / shortcut)
GET    /api/search?q=
POST   /api/ask
GET/POST /api/projects, POST /api/projects/:id/sources
GET/POST/DELETE /api/tokens     capture-token management
```

## 8. AI pipeline spec

**Builder: load the `claude-api` skill first.** Current conventions (do not use stale patterns): model `claude-opus-4-8`; **no** `temperature`/`top_p`/`budget_tokens` (they 400); thinking via `thinking: {type: "adaptive"}` if used; structured output via `output_config: {format: {type: "json_schema", schema}}` or the SDK's `parse()` helper — never prompt-and-hope JSON, never assistant prefill.

1. **URL fetch:** validate scheme http/https; **resolve DNS and reject private/loopback/link-local ranges (SSRF)**; 15s timeout; cap response size (~5MB); store final canonical URL.
2. **Extraction:** `@mozilla/readability` + `linkedom` (lighter than jsdom on serverless). Capture title/byline/published date where present. Detect paywall/empty extraction (< ~500 chars of text → `warnings: ["thin_extraction"]`; total failure → `status: 'failed'` with a human-readable reason). Don't chase 100% — a clear failure state beats a heroic scraper.
3. **Enrichment** (one Claude call, strict JSON schema): `summary` (2–3 sentences), `key_claims[]`, `topics[]` (≤6, lowercase), `entities[] {name, type: person|company|place|concept}`, `content_type`, `reading_time_minutes`, `warnings[]`. Nulls/empty lists when unknown — the model must not invent metadata. Truncate input to ~50k chars for enrichment (chunks still cover full text).
4. **Chunking:** by headings/paragraphs, target 400–800 tokens, ~15% overlap, preserve char offsets (citations depend on them).
5. **Embeddings:** OpenAI `text-embedding-3-small`, batched. Only embed after extraction succeeds. Re-embed on re-process (delete old chunks first — idempotency: the pipeline must be safe to re-run without duplicating chunks/metadata).
6. **Ask flow:** embed query + FTS in parallel → RRF blend → top ~8 chunks with source titles → Claude with instructions to answer **only** from provided evidence, cite every material claim `{source_id, chunk_index, quote}`, and set `insufficient_evidence: true` rather than speculate. Return structured JSON.

## 9. Security & correctness requirements

- Ownership enforced at the DB layer (RLS) **and** in service-role code paths.
- Deleting a source removes: storage object, extracted text, chunks+embeddings, metadata, highlights, notes, project links (FK cascades handle most; storage delete is explicit). Verify deleted content is absent from search/ask.
- Capture tokens stored hashed; rate-limit `/api/capture` and `/api/ask` (simple per-user counter in Postgres is fine at this scale).
- Never expose service-role key or storage paths client-side; signed URLs expire ≤1h.
- Uploaded files: validate MIME + size; treat as untrusted.
- Keep prompts/logs free of unnecessary personal content.

## 10. Acceptance criteria (v1 done)

- [ ] From a phone, save a URL via share sheet (Android PWA or iOS Shortcut) in <15s of user effort.
- [ ] ≥90% of a 20-URL test set produce readable extraction or an explicit failure state.
- [ ] Saved → searchable (exact phrase AND conceptual query both return it).
- [ ] Ask-my-library answers cite exact sources/passages; refuses when no evidence exists.
- [ ] Highlights, notes, why-saved, and projects work.
- [ ] Deletion removes all derived data; gone from search and ask.
- [ ] A second test account cannot see the first account's data (test this explicitly).
- [ ] Deployed on Vercel, tagged, Ross using it daily.

## 11. Deferred (do not build yet)

Weekly digest email → first thing after a month of real saves. Chrome extension, email-in address, voice notes, screenshot OCR, Gmail/Drive connectors, relationship graph, collaboration, export, native apps. Resurfacing logic beyond the digest.

## 12. Product test (2 weeks after v1)

Load ~100 of Ross's real saved items, then ask: did capture get easier; did retrieval save something forgotten; did it surface a connection; would he be disappointed if it disappeared? If the last two aren't yes — improve retrieval before adding any feature.
