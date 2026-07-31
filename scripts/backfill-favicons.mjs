// Resolve and store a favicon URL for every source saved before favicons
// existed. One homepage fetch per distinct domain, then a bulk update.
//   node scripts/backfill-favicons.mjs [--force]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const force = process.argv.includes("--force");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Mirrors src/lib/pipeline/favicon.ts. Kept as a copy so this script stays a
// plain node file with no build step.
const BLOCKED_ICON_HOSTS = ["coljuegos.gov.co", "mintic.gov.co"];

function scoreIcon(rel, sizes, href) {
  let value = 0;
  if (/\bapple-touch-icon\b/i.test(rel)) value += 3;
  if (/\bicon\b/i.test(rel)) value += 2;
  if (/\.png(\?|$)/i.test(href)) value += 2;
  if (/\.ico(\?|$)/i.test(href)) value += 1;
  if (/\.svg(\?|$)/i.test(href)) value += 1;
  const largest = Math.max(0, ...sizes.split(/\s+/).map((p) => Number.parseInt(p, 10) || 0));
  if (largest >= 32 && largest <= 192) value += 2;
  return value;
}

function resolveFromHtml(html, pageUrl) {
  const candidates = [];
  for (const tag of html.slice(0, 200_000).match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "";
    if (!/icon/i.test(rel) || /mask-icon/i.test(rel)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const sizes = tag.match(/\bsizes=["']([^"']+)["']/i)?.[1] ?? "";
    candidates.push({ href, value: scoreIcon(rel, sizes, href) });
  }
  candidates.sort((a, b) => b.value - a.value);
  for (const candidate of candidates) {
    try {
      const resolved = new URL(candidate.href, pageUrl);
      if (!/^https?:$/.test(resolved.protocol)) continue;
      const host = resolved.hostname.replace(/^www\./, "");
      if (BLOCKED_ICON_HOSTS.some((b) => host.endsWith(b))) continue;
      return resolved.toString();
    } catch {}
  }
  return null;
}

async function iconFor(domain) {
  const base = `https://${domain}/`;
  try {
    const res = await fetch(base, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "GoodContent/0.3 (+https://content.rossgarlick.com)" },
    });
    const finalUrl = new URL(res.url || base);
    const finalHost = finalUrl.hostname.replace(/^www\./, "");
    if (BLOCKED_ICON_HOSTS.some((b) => finalHost.endsWith(b))) {
      return { url: null, note: "blocked by network interstitial" };
    }
    const declared = res.ok ? resolveFromHtml(await res.text(), finalUrl) : null;
    if (declared) return { url: declared, note: "declared" };
  } catch {
    // Fall through to the conventional path check.
  }

  try {
    const res = await fetch(`https://${domain}/favicon.ico`, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const type = res.headers.get("content-type") || "";
    if (res.ok && !type.includes("text/html")) {
      return { url: `https://${domain}/favicon.ico`, note: "conventional" };
    }
  } catch {}

  return { url: null, note: "none found" };
}

const query = db.from("sources").select("id, canonical_url, favicon_url");
const { data, error } = force ? await query : await query.is("favicon_url", null);
if (error) throw new Error(error.message);

const byDomain = new Map();
for (const source of data ?? []) {
  let host;
  try {
    host = new URL(source.canonical_url).hostname.replace(/^www\./, "");
  } catch {
    continue;
  }
  if (host === "x.com" || host === "twitter.com") continue;
  if (!byDomain.has(host)) byDomain.set(host, []);
  byDomain.get(host).push(source.id);
}

console.log(`${byDomain.size} domains across ${data?.length ?? 0} sources\n`);
let stored = 0;
for (const [host, ids] of byDomain) {
  const { url, note } = await iconFor(host);
  if (url) {
    const { error: updateError } = await db
      .from("sources")
      .update({ favicon_url: url })
      .in("id", ids);
    if (updateError) {
      console.log(`  ${host}: UPDATE FAILED ${updateError.message}`);
      continue;
    }
    stored += ids.length;
    console.log(`  ${host} (${ids.length}): ${note}`);
  } else {
    console.log(`  ${host} (${ids.length}): ${note} — card keeps its monogram`);
  }
}
console.log(`\nstored an icon for ${stored} sources`);
