# Good Content — where things stand and what's next

**Updated:** 2026-08-03 · **Version:** v0.5.0

The single doc to read when picking this up. `BUILD_PLAN.md` holds the settled
architectural decisions (don't relitigate them); `AGENTS.md` holds the security
rules that survive every change.

---

## Live

| | |
|---|---|
| App | https://content.rossgarlick.com (also `pocket2-0.vercel.app`) |
| Public reading page | https://rossgarlick.com/timeless-content |
| Repos | `mancunianinnyc/pocket2.0` (app) · `mancunianinnyc/rossrambles` (site) |
| Supabase | project `flbjlwckcgtlamnpabmj`, us-east-2 |
| Model | `gpt-5.6-luna` via `src/lib/llm.ts`; embeddings still OpenAI `text-embedding-3-small` |

**Library:** 90 sources — 78 ready, 12 failed (all paywall/bot-block), 5 starred,
346 chunks, 60 with a resolved favicon.

---

## Running it

```bash
# dev server (port 3200)
cd "C:\Users\rossg\Claude Workspace\personal-library" && corepack pnpm dev --port 3200

# sign in without email: prints a one-time callback URL
node scripts/dev-login-link.mjs 3200
node scripts/dev-login-link.mjs https://content.rossgarlick.com

# checks, then deploy
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build
npx vercel@latest deploy --prod --yes
```

Pushing is hands-free: the remote uses the `github-pocket2` SSH alias backed by
`~/.ssh/pocket2_deploy`, registered as a deploy key with write access. No PAT.

The **site** repo deploys on push to `main` (`git push origin main`), and
`/timeless-content` re-reads the feed on its own once a day.

---

## Done

Phases 1–3 of `BUILD_PLAN.md` are complete and verified live. Of the plan's
acceptance criteria, these are closed:

- Save → extract → enrich → embed → searchable, on a phone, in one tap
- Hybrid search returns both exact-phrase and conceptual matches
- Ask cites exact passages and refuses when the evidence isn't there
- Deleting a source removes every derived row and it vanishes from search and Ask
- A second account cannot see this account's data (12/12 assertions)
- Deployed, tagged, and in daily use

Beyond the plan: starring publishes to the public reading page, the PWA captures
in the background so a save survives closing the app, and extraction now fails
loudly when a network block page is served instead of an article.

---

## Next, in order

**1. Notes.** The one Ross asked for. Schema already has `notes` (0 rows) with
`note_type` of `personal_note` or `why_saved`. Needs: an editable note on the
reader, an editable `why_saved`, and a place for them on the card. Worth doing
before more capture features — it turns the library from an archive into
something written in.

**2. Topic normalization.** 78 enriched items produced **356 distinct topics**,
only 39 shared by more than one item, and the vocabulary is bilingual
("regulación" alongside "venture capital"). The filter chips run off that thin
overlap and degrade as the library grows. Fix at the enrichment prompt (a
controlled vocabulary) plus a clustering pass over what's stored.

**3. The 12 failed sources.** All paywall or bot-block failures — WSJ, NYT,
Economist, Bloomberg, WaPo. Either recover them with browser-captured text via
`scripts/reprocess-with-text.mjs`, or prune them so the library stops carrying
dead weight.

**4. Highlights.** Select text in the reader, store with offsets. Schema ready.

**5. Projects.** Group sources; filter library, search, and Ask by project.

**6. PDF upload.** Private Supabase Storage bucket → same pipeline. The only
phase-4 item that needs new infrastructure.

**7. Digest email.** The plan defers this until a month of real saves — that
milestone is close.

---

## Not code — waiting on Ross

- **Rotate the remaining secrets:** `sb_secret`, DB password, Anthropic and
  OpenAI keys. The GitHub PAT is already replaceable and can just be revoked.
  After rotating, update `.env.local` and the Vercel production envs, then
  redeploy.
- **Paste the magic-link email template** into Supabase → Authentication →
  Emails → Magic Link. Source of truth: `supabase/email-templates/magic-link.html`.

---

## Known issues

- `processing_error` surfaces raw API JSON for some failures rather than a
  human sentence.
- The reading page shows the AI blurb; there is no way to write your own line
  yet. Notes (item 1) is the natural home for that.
- Enrichment quality on `gpt-5.6-luna` has been spot-checked, not swept across
  the whole library. Re-enriching everything would cost a few dollars and give
  a consistent baseline.

---

## Conventions worth keeping

- Tag every release (`v0.5.0`) and say what changed since the previous tag.
- `typecheck` + `lint` + `build` before any deploy; verify on the live URL after.
- Service-role queries always filter by `user_id` explicitly — RLS does not
  apply to that key (`AGENTS.md`).
- The public feed's column list is the entire security boundary for what the
  world can read. Never add `extracted_text` to it.
