# Good Content agent guide

- Follow `BUILD_PLAN.md`; its product and stack decisions are settled.
- Keep the UI mobile-first and calm.
- Use Next.js App Router Server Components by default and `src/proxy.ts` for
  session refresh. Re-check authorization inside pages and route handlers.
- Initialize service clients lazily so builds do not require runtime secrets.
- Every service-role query must filter explicitly by `user_id`.
- Every user-owned table must have RLS and ownership-safe foreign keys.
- Never expose the Supabase service-role key, capture-token hashes, or private
  storage paths to browser code.
- Validate every redirect target during URL fetching; do not weaken SSRF checks.
- Keep AI outputs structured. Ask must answer only from retrieved evidence and
  validate citation quotes against the retrieved chunk.
- Pin dependency versions and commit `pnpm-lock.yaml`.
- Before handoff, run `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
