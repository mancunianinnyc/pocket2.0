import type { LibrarySource } from "@/types/library";

/** Old enough that seeing it again is a reminder, not a repeat. */
const MIN_AGE_DAYS = 30;

/**
 * The ids of older, readable saves in a fresh random order. Computed on the
 * server per request, so the "From your library" pick changes on each visit
 * and the browser renders exactly what the server did.
 */
export function resurfaceOrder(sources: LibrarySource[], limit = 40) {
  const cutoff = Date.now() - MIN_AGE_DAYS * 86_400_000;
  const pool = sources
    .filter(
      (source) =>
        source.status === "ready" &&
        new Date(source.saved_at).getTime() < cutoff,
    )
    .map((source) => source.id);

  // Fisher–Yates.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}
