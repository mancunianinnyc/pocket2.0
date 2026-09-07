// Save the verified Pocket recoveries into the library through the real API,
// then clean up after itself: anything that fails to process is deleted rather
// than left behind, and a truncated extracted title is replaced by the title
// from the Dropbox filename.
//   node scripts/restore-pocket.mjs [--base https://content.rossgarlick.com]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "https://content.rossgarlick.com";
const WHY = "Restored from the Favourite Pocket Articles archive (Dropbox)";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// --- authenticate as Ross the way the dev login script does ---
const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "rossgarlick@gmail.com",
});
if (linkError) throw new Error(`could not mint a session: ${linkError.message}`);
const callback = `${BASE}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/library`;
const authResponse = await fetch(callback, { redirect: "manual" });
const cookie = (authResponse.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .join("; ");
if (!cookie) throw new Error("no session cookie returned from the callback");

const inArg = process.argv.indexOf("--in");
const IN = inArg > -1 ? process.argv[inArg + 1] : "scripts/data/pocket-verified.json";
const verified = JSON.parse(readFileSync(path.join(repoRoot, IN), "utf8"));
const targets = Object.entries(verified).filter(([, r]) => r.verdict === "OK");
console.log(`saving ${targets.length} verified articles to ${BASE}\n`);

const saved = [];
const skipped = [];

for (const [title, result] of targets) {
  const response = await fetch(`${BASE}/api/sources`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ url: result.url, why_saved: WHY }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) {
    skipped.push({ title, reason: "already in the library" });
    console.log(`  dup   ${title.slice(0, 60)}`);
    continue;
  }
  if (!body.source?.id) {
    skipped.push({ title, reason: body.error ?? `HTTP ${response.status}` });
    console.log(`  fail  ${title.slice(0, 60)} — ${body.error ?? response.status}`);
    continue;
  }
  saved.push({ title, id: body.source.id, url: result.url });
  console.log(`  queued ${title.slice(0, 60)}`);
  await new Promise((r) => setTimeout(r, 1_200));
}

console.log(`\nqueued ${saved.length}; waiting for the pipeline…\n`);

// --- wait for every row to settle ---
const ids = saved.map((s) => s.id);
let pending = [...ids];
for (let round = 0; round < 60 && pending.length; round++) {
  await new Promise((r) => setTimeout(r, 10_000));
  const { data } = await admin.from("sources").select("id, status").in("id", pending);
  pending = (data ?? []).filter((s) => s.status === "queued" || s.status === "processing").map((s) => s.id);
  if (pending.length) console.log(`  ${pending.length} still processing…`);
}

// --- keep the good, delete the failed, fix poor titles ---
const { data: finals } = await admin
  .from("sources")
  .select("id, title, status, processing_error, canonical_url")
  .in("id", ids);

const kept = [];
const dropped = [];
for (const row of finals ?? []) {
  const entry = saved.find((s) => s.id === row.id);
  if (row.status !== "ready") {
    await admin.from("sources").delete().eq("id", row.id);
    dropped.push({ title: entry.title, url: entry.url, reason: row.processing_error?.slice(0, 90) ?? row.status });
    continue;
  }
  // The Dropbox filename is often a better title than a truncated page title.
  const extracted = row.title ?? "";
  if (extracted.length < entry.title.length * 0.6 || /\.\.\.$|…$/.test(extracted)) {
    await admin.from("sources").update({ title: entry.title }).eq("id", row.id);
    kept.push({ title: entry.title, id: row.id, retitled: true });
  } else {
    kept.push({ title: extracted, id: row.id, retitled: false });
  }
}

writeFileSync(
  path.join(repoRoot, `${IN.replace(/\.json$/, "")}-report.json`),
  JSON.stringify({ ran_at: new Date().toISOString(), kept, dropped, skipped }, null, 1),
);

console.log(`\nKEPT ${kept.length}`);
for (const k of kept) console.log(`  ✓ ${k.title}${k.retitled ? "  (retitled)" : ""}`);
console.log(`\nDROPPED ${dropped.length}`);
for (const d of dropped) console.log(`  ✗ ${d.title} — ${d.reason}`);
if (skipped.length) {
  console.log(`\nSKIPPED ${skipped.length}`);
  for (const s of skipped) console.log(`  · ${s.title} — ${s.reason}`);
}
