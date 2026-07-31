import "server-only";

/**
 * Sites declare icons in wildly different ways — Substack points at a CDN,
 * Vox at a hashed asset path, Stratechery declares nothing at all. Resolve the
 * declared icon where there is one and fall back to the conventional path.
 */
const ICON_LINK = /<link\b[^>]*>/gi;

/** A blocked network rewrites pages, so an icon can point at the block page. */
const BLOCKED_ICON_HOSTS = ["coljuegos.gov.co", "mintic.gov.co"];

function score(rel: string, sizes: string, href: string) {
  let value = 0;
  if (/\bapple-touch-icon\b/i.test(rel)) value += 3;
  if (/\bicon\b/i.test(rel)) value += 2;
  if (/\.png(\?|$)/i.test(href)) value += 2;
  if (/\.ico(\?|$)/i.test(href)) value += 1;
  if (/\.svg(\?|$)/i.test(href)) value += 1;
  const largest = Math.max(
    0,
    ...sizes.split(/\s+/).map((pair) => Number.parseInt(pair, 10) || 0),
  );
  // Prefer something crisp at 34-44px without hauling a 512px PWA icon.
  if (largest >= 32 && largest <= 192) value += 2;
  return value;
}

export function resolveFaviconUrl(html: string, pageUrl: URL): string | null {
  const candidates: Array<{ href: string; value: number }> = [];

  for (const tag of html.slice(0, 200_000).match(ICON_LINK) ?? []) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "";
    if (!/icon/i.test(rel) || /mask-icon/i.test(rel)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const sizes = tag.match(/\bsizes=["']([^"']+)["']/i)?.[1] ?? "";
    candidates.push({ href, value: score(rel, sizes, href) });
  }

  candidates.sort((a, b) => b.value - a.value);

  for (const candidate of candidates) {
    try {
      const resolved = new URL(candidate.href, pageUrl);
      if (resolved.protocol !== "https:" && resolved.protocol !== "http:") continue;
      const host = resolved.hostname.replace(/^www\./, "");
      if (BLOCKED_ICON_HOSTS.some((blocked) => host.endsWith(blocked))) continue;
      return resolved.toString();
    } catch {
      // Skip an unparseable href and try the next candidate.
    }
  }

  const host = pageUrl.hostname.replace(/^www\./, "");
  if (BLOCKED_ICON_HOSTS.some((blocked) => host.endsWith(blocked))) return null;
  return `${pageUrl.origin}/favicon.ico`;
}
