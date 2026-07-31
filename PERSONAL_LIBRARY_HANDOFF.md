# Good Content — Claude Code Handoff

**Prepared:** 2026-07-27  
**Owner:** Ross Garlick (`rossgarlick@gmail.com`)  
**GitHub account:** `mancunianinnyc`  
**Project directory:** `C:\Users\rossg\Claude Workspace\personal-library`

## Start here

The project source has been built and copied into:

```text
C:\Users\rossg\Claude Workspace\personal-library
```

Read these files first:

1. `BUILD_PLAN.md` — approved product plan; its decisions are settled.
2. `AGENTS.md` — repository implementation and security rules.
3. `README.md` — setup, environment variables, verification, and deployment.
4. `supabase/migrations/20260727000100_initial_schema.sql` — initial schema, RLS, vector search, rate limits, and auth allowlist.

Do not start over or scaffold another app. Continue from the existing source.

## Current status

The application compiles successfully and covers the core of build phases 1–3:

- Next.js 16.2.12 App Router with TypeScript and Tailwind CSS 4.
- Mobile-first Library, Reader, Search, Ask, Login, Settings, and Quick Save screens.
- Supabase SSR browser/server clients and Next.js 16 `src/proxy.ts` session refresh.
- Magic-link authentication.
- Ross-only signup gate through `private.allowed_emails`.
- Initial PostgreSQL schema with pgvector, FTS, RLS, cascading ownership relationships, and a private Storage bucket.
- URL capture and inline processing:
  - HTTP/HTTPS validation.
  - DNS and redirect-by-redirect SSRF protection.
  - Private, loopback, link-local, and internal hostname rejection.
  - 15-second timeout and approximately 5 MB response cap.
  - Readability + Linkedom extraction.
  - Claude structured enrichment.
  - Paragraph-aware chunking with offsets.
  - OpenAI `text-embedding-3-small` embeddings at 1,536 dimensions.
  - Idempotent metadata/chunk replacement.
  - Explicit `queued`, `processing`, `ready`, and `failed` states.
- PWA support:
  - Manifest and icon.
  - Service worker that does not cache authenticated pages.
  - Android Web Share Target.
  - Auto-save handoff through `/share-target` → `/save`.
- Personal capture API:
  - Hashed, revocable, show-once tokens.
  - `POST /api/capture`.
  - Next.js `after()` processing after a `202` response.
  - Per-user database-backed rate limits.
  - iOS Shortcut instructions in `docs/ios-shortcut.md`.
  - Desktop bookmarklet in Settings.
- Retrieval:
  - PostgreSQL FTS + pgvector hybrid search.
  - Reciprocal-rank fusion SQL function.
  - Evidence-constrained Ask flow.
  - Structured citations with exact-quote validation against retrieved chunks.
  - Saved question history at the database layer.

## Verification already completed

The source was installed and verified in a sandbox staging directory, then copied to the project directory.

These passed:

```text
pnpm typecheck
pnpm lint
pnpm build
```

The production build successfully compiled all application routes, including:

```text
/api/ask
/api/capture
/api/search
/api/sources
/api/sources/[id]
/api/sources/[id]/retry
/api/tokens
/ask
/auth/callback
/docs/ios-shortcut
/library
/library/[id]
/login
/save
/search
/settings
/share-target
```

The source sync was checked: 64 source/configuration files matched between the verified staging copy and the requested project directory, excluding dependencies and build artifacts.

These checks only prove compilation and static correctness. Nothing has been tested against a live Good Content Supabase database or live AI API keys yet.

## Cloud connection findings

### GitHub

Not ready yet.

- `mancunianinnyc/personal-library` returned `404 Not Found`.
- The connected GitHub app exposed zero repositories for `mancunianinnyc`.
- The shell used during the build did not have `gh` on `PATH`.
- A local `.git` directory was initialized on branch `main`, but the sandbox could not write its metadata afterward because the external folder is owned by Ross’s Windows user rather than the sandbox account.
- There is no commit or tag yet.

Required action:

1. Create the private repository `mancunianinnyc/personal-library`.
2. Grant the GitHub app access to it, or use Ross’s authenticated `gh` CLI.
3. Commit and push the existing source.

Suggested first commit:

```powershell
cd "C:\Users\rossg\Claude Workspace\personal-library"
git config user.name "mancunianinnyc"
git config user.email "rossgarlick@gmail.com"
git add --all
git commit -m "feat: build personal library foundation"
git remote add origin https://github.com/mancunianinnyc/personal-library.git
git push -u origin main
```

Do not tag `v0.1.0` yet. Tag it after the live v1 acceptance checks pass.

### Supabase

Account-level connection works.

Visible organization:

```text
mancunianinnyc's Org
organization id: mnorpdczwxkraiuajfoy
```

Existing project:

```text
ConvictionELO
project ref: ucvlnjhdsmyumfehnqnq
region: ca-central-1
status: ACTIVE_HEALTHY
```

The new `personal-library` project does not exist yet.

Before creating it, confirm:

- Organization: `mancunianinnyc's Org`
- Region:
  - `us-east-1` is the latency recommendation for Bogotá.
  - `ca-central-1` matches ConvictionELO.
- Supabase creation cost after querying the organization-specific price.

After creation:

1. Retrieve the project URL and publishable key.
2. Retrieve or configure the service-role key securely.
3. Obtain the pooler connection string on port 6543.
4. Obtain the direct migration connection string on port 5432.
5. Link the local CLI.
6. Apply migration 001.
7. Run security and performance advisors.
8. Configure Auth redirect URLs for localhost, Vercel previews, and production.
9. Test the allowlist and cross-account isolation.

Suggested commands:

```powershell
cd "C:\Users\rossg\Claude Workspace\personal-library"
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase migration list
supabase db advisors
```

Do not apply the migration to the existing ConvictionELO project.

### Vercel

Account-level connection works.

Visible team:

```text
MancunianinNYC
team slug: mancunianin-nyc
team id: team_J3J1H6aR58yX8z7aABoBYVkK
```

Visible project:

```text
convictionelo
project id: prj_08rEhnlvMnqiMcRRrfK3IkWJNNRc
```

The new `personal-library` Vercel project does not exist yet.

Create/link it only after the GitHub repository exists. Configure all required environment variables before the first meaningful production test.

## Required environment variables

Create `.env.local` locally. Do not commit it and do not paste secrets into chat.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Legacy fallback supported:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_DATABASE_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
APP_BASE_URL=http://localhost:3000
```

Production `APP_BASE_URL` must be the canonical HTTPS Vercel/custom domain.

The OpenAI secure key selector was opened with the suggested key name:

```text
personal-library-embeddings
```

No key was written to a file during this session.

The Anthropic key is also still missing.

## Important implementation notes

### Supabase key naming

The current code prefers:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

It also accepts the build plan’s legacy:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

### Service-role ownership

Every service-role operation must explicitly filter by the resolved `user_id`.
Do not rely on RLS for service-role calls because the role bypasses RLS.

### Auth

The initial migration seeds:

```text
rossgarlick@gmail.com
```

into `private.allowed_emails`.

The Auth trigger rejects other emails until they are deliberately invited.

### Anthropic

The code uses:

```text
claude-opus-4-8
thinking: { type: "adaptive" }
output_config.format: JSON Schema through zodOutputFormat()
```

No `temperature`, `top_p`, or `budget_tokens` are sent.

The previously requested `claude-api` Codex skill was not installed. The implementation was instead checked against the installed current `@anthropic-ai/sdk` types and helpers. Confirm that Ross’s Anthropic account can access `claude-opus-4-8` before the first live run.

### OpenAI

OpenAI is used only for:

```text
text-embedding-3-small
```

The migration and application both expect 1,536-dimensional vectors.

### Dependency decisions

- Versions are pinned exactly.
- `pnpm-lock.yaml` is present.
- TypeScript was pinned to `6.0.3` because the current `typescript-eslint` dependency did not support TypeScript 7.
- ESLint was pinned to `9.39.5` because `eslint-plugin-react` was incompatible with ESLint 10.

Do not blindly upgrade those two packages without rerunning typecheck, lint, and build.

## What remains unimplemented

The schema includes several later-stage entities, but their complete APIs and UIs are not finished.

Still needed:

- Highlights UI and persistence workflow.
- Personal notes UI and APIs.
- Editable “why I saved this” UI.
- Projects CRUD, source assignment, filters, and Ask/Search project scoping UI.
- PDF upload to private Supabase Storage.
- PDF MIME/size validation and text extraction.
- Clear failure handling for image-only PDFs.
- Settings invite-gate management.
- Account deletion.
- Saved Ask history UI.
- Full source editing UI.
- Real backlog import.
- Comprehensive automated tests.
- Live mobile/PWA installation tests.
- Live extraction test against the planned 20-URL fixture set.
- Cross-account RLS test.
- Deletion verification against Search and Ask.
- GitHub push, Vercel project creation, environment configuration, deployment, and release tag.

## Recommended continuation order

1. Fix GitHub access and commit the current source.
2. Create the new Supabase project after organization, region, and cost confirmation.
3. Create `.env.local` securely.
4. Apply migration 001.
5. Run Supabase advisors and fix every relevant finding.
6. Run the app locally.
7. Test magic-link login and URL capture end to end.
8. Test exact and semantic search.
9. Test Ask with supported and unsupported questions.
10. Add a second invited test account and prove RLS isolation.
11. Verify deletion removes metadata and chunks from retrieval.
12. Connect GitHub to a new Vercel project and configure env vars.
13. Deploy a preview and test on a phone.
14. Implement the remaining phase-4 product layer.
15. Run the full acceptance checklist, deploy production, then tag `v0.1.0`.

## First Claude Code prompt

Paste the following into the new Claude Code session:

```text
Continue the Good Content project in:
C:\Users\rossg\Claude Workspace\personal-library

Read BUILD_PLAN.md, AGENTS.md, README.md, and PERSONAL_LIBRARY_HANDOFF.md if I
have copied it into the repository. The build-plan decisions are settled; do
not restart or re-scaffold.

First inspect the repository and current git status. Then help me complete the
external setup in this order:

1. Confirm/create the private GitHub repo mancunianinnyc/personal-library and
   commit/push the existing source.
2. Create a new Supabase project named personal-library only after confirming
   the organization, region, and cost.
3. Configure secrets without printing or committing them.
4. Apply and validate migration 001, run Supabase security/performance advisors,
   and fix any findings.
5. Run pnpm typecheck, pnpm lint, and pnpm build.
6. Start the app and test the phase-1 vertical slice end to end.
7. Connect and deploy through the MancunianinNYC Vercel team.

Important:
- Never touch the existing ConvictionELO Supabase/Vercel projects.
- Never expose the service-role key.
- Every service-role query must filter explicitly by user_id.
- Preserve the SSRF checks and RLS model.
- Do not tag v0.1.0 until the live acceptance tests pass.

After the external setup is working, continue the unimplemented phase-4 items
listed in the handoff.
```

## Definition of the next successful milestone

The next milestone is complete when:

- The code is committed and pushed to the new private GitHub repository.
- A new Supabase project exists and migration 001 is applied cleanly.
- Advisors have no unresolved critical security findings.
- Ross can sign in locally.
- Saving a real URL reaches `ready` or a clear `failed` state.
- The saved item appears in Search.
- Ask returns a cited answer or explicitly refuses for insufficient evidence.
- A preview deployment works on Ross’s phone.

