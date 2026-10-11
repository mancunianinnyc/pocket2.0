# Good Content — where things stand and what's next

**Updated:** 2026-10-11 · **Version:** v0.7.0 (+ Pocket-archive recovery)

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

**Library (2026-10-11):** 145 sources — 130 ready, 15 failed, 6 starred.
12 saves in the last 30 days, 0 in the last 7. **7 Ask queries ever. 0 notes,
0 highlights, 0 projects, 0 capture tokens.**

That last line is the diagnosis that shapes the plan below: getting things *in*
works; getting value back *out* doesn't happen. The library is an archive that
is written to and rarely read from.

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
in the background so a save survives closing the app, extraction fails loudly
on network block pages, YouTube/Spotify/Dropbox-PDF links save (v0.6–0.7), and
29 articles were recovered from the 2014–2018 Favourite Pocket archive.

---

## Next, in order

The order below came out of a comparison with **Sublime** (sublime.app, "save
one idea, discover 100 more") on 2026-10-11. Sublime's whole bet is on the
*return* path — related ideas on every save, collections over tags, highlights
as first-class cards, resurfacing. That is exactly the half of Good Content
nobody uses yet. Deliberately **not** copied: cross-user discovery (needs a
network), the infinite canvas, likes/follows, pricing tiers.

**0. Phone capture Shortcut (not code, ~5 min).** Zero capture tokens exist, so
the iOS Shortcut was never set up — saving from the phone is more taps than it
should be, and saves have dried up. Settings → create token → install Shortcut.

**1. "Connects to" — related items on every reader.** *(Building 2026-10-11.)*
Each source's chunk embeddings are averaged into a centroid; the reader shows
up to five other sources whose centroids are closest, with the passage in each
that best matches. A similarity floor (0.45, calibrated against the real
library: median pair 0.30, p90 0.49) keeps weak matches out — showing nothing
beats showing noise. Because the reader refreshes itself while processing, a
fresh save lands on its connections the moment it's ready.

**2. Resurfacing: shuffle + weekly "from your library".** A random-item button
on the library page, and a weekly message with one older save, its brief, and
its top two connections (reuses item 1). Delivery to Ross's Slack self-DM fits
the existing daily-plan habit better than email; this replaces the old "digest
email" item.

**3. Collections instead of tags (replaces topic normalization + projects).**
356 AI topics, only 39 shared — the chips never worked. Sublime reached the
same conclusion ("AI tagging alone" isn't enough). Rename projects →
collections in the UI (tables `projects`/`source_projects` already exist), let
an item sit in many, filter library/search/Ask by collection. AI topics stay as
a background signal for search and connections, not as filter chips.

**4. Notes and highlights as their own cards.** Both tables exist, both empty.
A highlight or a standalone note becomes a card in the library that links back
to its source and gets its own connections. Notes were Ross's original ask; this
is the version of it that turns the archive into something written in. Index
notes and `why_saved` in search so half-remembered context ("that thing I saved
before the Palomma offer") finds things.

**5. Good Content MCP server.** `search_library`, `ask_library`, `save_url` —
authenticated with the same per-device tokens as `/api/capture`, every query
scoped to the token's `user_id` (`AGENTS.md`). Makes the library usable from
Claude Code and Pipo (WhatsApp → saved). Sublime gates this behind Premium.

**6. Kindle / Readwise highlight import.** Fills item 4 with years of material
on day one; the import Sublime leads with.

**7. Leftovers from the old list.** The 15 failed sources (recover via
`scripts/reprocess-with-text.mjs` or prune), PDF upload to a private Storage
bucket.

---

## Not code — waiting on Ross

- **Rotate the remaining secrets:** `sb_secret`, DB password, Anthropic and
  OpenAI keys. The GitHub PAT is already replaceable and can just be revoked.
  After rotating, update `.env.local` and the Vercel production envs, then
  redeploy.
- **Paste the magic-link email template** into Supabase → Authentication →
  Emails → Magic Link. Source of truth: `supabase/email-templates/magic-link.html`.
- **`YOUTUBE_API_KEY`** for video descriptions (then re-retry the video saves).

---

## Known issues

- `processing_error` surfaces raw API JSON for some failures rather than a
  human sentence.
- The reading page shows the AI blurb; there is no way to write your own line
  yet. Notes (item 4) is the natural home for that.
- Enrichment quality on `gpt-5.6-luna` has been spot-checked, not swept across
  the whole library.
- Multi-topic digests (Stratechery dailies) have generic centroids and show up
  as connections more often than they deserve. Revisit if it gets noisy.

---

## Conventions worth keeping

- Tag every release (`v0.5.0`) and say what changed since the previous tag.
- `typecheck` + `lint` + `build` before any deploy; verify on the live URL after.
- Service-role queries always filter by `user_id` explicitly — RLS does not
  apply to that key (`AGENTS.md`).
- The public feed's column list is the entire security boundary for what the
  world can read. Never add `extracted_text` to it.
