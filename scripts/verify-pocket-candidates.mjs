// Fetch every candidate URL for the Pocket recovery and classify it.
// Nothing is saved to the library here — this only decides what is worth saving.
//   node scripts/verify-pocket-candidates.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inArg = process.argv.indexOf("--in");
const outArg = process.argv.indexOf("--out");
const IN = inArg > -1 ? process.argv[inArg + 1] : "scripts/data/pocket-candidates.json";
const OUT = outArg > -1 ? process.argv[outArg + 1] : "scripts/data/pocket-verified.json";
const candidates = JSON.parse(readFileSync(path.join(repoRoot, IN), "utf8"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const STOP = new Set(["the","a","an","of","and","to","in","for","is","it","on","at","that","this","with","how","why","s","t"]);
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

/** Share of the Pocket title's meaningful words that appear in the page title. */
function overlap(pocketTitle, pageTitle) {
  const a = tokens(pocketTitle);
  const b = tokens(pageTitle);
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit += 1;
  return hit / a.size;
}

/** Rough paywall/consent-wall detection: a real article has real body text. */
function bodyTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

const PAYWALL_MARKERS = [
  "subscribe to continue",
  "already a subscriber",
  "create a free account to continue",
  "you have reached your article limit",
  "this content is available to subscribers",
  "please enable js",
  "are you a robot",
  "access denied",
  "just a moment",
];

async function classify(title, url) {
  if (!url) return { verdict: "NO_URL", url };
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return { verdict: "DEAD", url, detail: error.message.slice(0, 60) };
  }

  if (!response.ok) {
    return { verdict: response.status === 404 ? "DEAD" : "BLOCKED", url, detail: `HTTP ${response.status}` };
  }

  const finalUrl = response.url || url;
  const html = (await response.text()).slice(0, 400_000);
  const pageTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)</i)?.[1] ??
    "";
  const text = bodyTextLength(html);
  const score = overlap(title, pageTitle);
  const lower = html.toLowerCase();
  const walled = PAYWALL_MARKERS.some((m) => lower.includes(m));

  if (score < 0.5) {
    return { verdict: "MISMATCH", url: finalUrl, detail: `got "${pageTitle.slice(0, 70)}"`, score };
  }
  if (walled || text < 2_500) {
    return { verdict: "PAYWALLED", url: finalUrl, detail: `${text} chars of text`, score };
  }
  return { verdict: "OK", url: finalUrl, detail: `${text} chars`, score, pageTitle };
}

const entries = Object.entries(candidates);
const results = {};
const limit = 6;
let index = 0;

async function worker() {
  while (index < entries.length) {
    const i = index++;
    const [title, url] = entries[i];
    const result = await classify(title, url);
    results[title] = result;
    console.log(`${String(i + 1).padStart(3)} ${result.verdict.padEnd(10)} ${title.slice(0, 58).padEnd(58)} ${result.detail ?? ""}`);
  }
}

await Promise.all(Array.from({ length: limit }, worker));

writeFileSync(
  path.join(repoRoot, OUT),
  JSON.stringify(results, null, 1),
);

const tally = {};
for (const r of Object.values(results)) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.log("\n" + JSON.stringify(tally, null, 1));
