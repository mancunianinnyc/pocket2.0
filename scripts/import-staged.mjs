// One-off importer for a staged collection of articles, saved emails, and
// X bookmarks. Mirrors src/lib/pipeline/* (which is server-only +
// TS-path-aliased, so the logic is duplicated here rather than imported).
// The manifest lives outside git (personal data). Run:
//   node scripts/import-staged.mjs [path/to/manifest.json]
// Manifest shape: { toolResultsDir, emailFilePattern,
//   articles: [{url, saved, why}],
//   emails: [{threadId, canonical, title, saved, why}],
//   tweets: [{url, handle, name, saved, text}] }
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- env ----------
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

// ---------- pipeline mirrors ----------
const TARGET_CHARS = 2800, OVERLAP_CHARS = 420;
function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const targetEnd = Math.min(start + TARGET_CHARS, text.length);
    let end = targetEnd;
    if (targetEnd < text.length) {
      const p = text.lastIndexOf("\n\n", targetEnd);
      const s = text.lastIndexOf(". ", targetEnd);
      const best = Math.max(p + 2, s + 2);
      if (best > start + TARGET_CHARS * 0.55) end = best;
    }
    const slice = text.slice(start, end);
    const chunk = slice.trim();
    const actualStart = start + (slice.length - slice.trimStart().length);
    if (chunk) chunks.push({ chunkIndex: chunks.length, text: chunk, startOffset: actualStart, endOffset: actualStart + chunk.length });
    if (end >= text.length) break;
    const nextStart = Math.max(end - OVERLAP_CHARS, start + 1);
    const pa = text.indexOf("\n\n", nextStart);
    start = pa !== -1 && pa < end ? pa + 2 : nextStart;
  }
  return chunks;
}

async function embedTexts(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts.slice(i, i + 100), encoding_format: "float" });
    out.push(...r.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

const enrichmentResponseSchema = z.object({
  summary: z.string().min(1),
  key_claims: z.array(z.string().min(1)),
  topics: z.array(z.string().min(1)),
  entities: z.array(z.object({ name: z.string().min(1), type: z.enum(["person", "company", "place", "concept"]) })),
  content_type: z.string().min(1),
  reading_time_minutes: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1)),
});

function normalizeEnrichment(raw) {
  return {
    summary: raw.summary.slice(0, 1200),
    key_claims: raw.key_claims.slice(0, 8).map((c) => c.slice(0, 500)),
    topics: raw.topics.slice(0, 6).map((t) => t.slice(0, 60).toLowerCase()),
    entities: raw.entities.slice(0, 15).map((e) => ({ ...e, name: e.name.slice(0, 120) })),
    content_type: raw.content_type.slice(0, 80),
    reading_time_minutes: Math.min(raw.reading_time_minutes, 999),
    warnings: raw.warnings.slice(0, 10).map((w) => w.slice(0, 120)),
  };
}

async function enrichArticle({ title, url, text, extractionWarnings }) {
  const message = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(enrichmentResponseSchema) },
    system:
      "You organize a private reading library. Extract only facts supported by the supplied article. Never invent missing metadata. Keep summaries calm, specific, and useful for later retrieval. Topic labels must be lowercase. Limits: at most 8 key claims, 6 topics, 15 entities, 10 warnings; summary under 1200 characters.",
    messages: [{ role: "user", content: `Title: ${title}\nURL: ${url}\nExtraction warnings: ${extractionWarnings.join(", ") || "none"}\n\nArticle:\n${text.slice(0, 50000)}` }],
  });
  if (!message.parsed_output) throw new Error("The enrichment model returned no structured output.");
  return normalizeEnrichment(message.parsed_output);
}

function cleanText(v) {
  return v.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractArticle(url) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "PersonalLibrary/0.1 (+https://github.com/mancunianinnyc/personal-library)" },
  });
  if (!res.ok) throw new Error(`The site returned HTTP ${res.status}.`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("text/html") && !ct.includes("xhtml")) throw new Error("Not an HTML article.");
  const html = await res.text();
  const { document } = parseHTML(html);
  const published = (() => {
    for (const sel of ['meta[property="article:published_time"]', 'meta[name="date"]', 'meta[name="pubdate"]', "time[datetime]"]) {
      const el = document.querySelector(sel);
      const v = el?.getAttribute("content") || el?.getAttribute("datetime");
      if (v && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
    }
    return null;
  })();
  const article = new Readability(document, { charThreshold: 100 }).parse();
  if (!article?.content) throw new Error("No readable article content on that page.");
  const readable = parseHTML(article.content).document;
  const blocks = Array.from(readable.querySelectorAll("h1, h2, h3, p, blockquote, li, pre")).map((e) => cleanText(e.textContent ?? "")).filter(Boolean);
  const text = cleanText(blocks.join("\n\n") || article.textContent || "");
  if (text.length < 100) throw new Error("The page did not contain enough readable text.");
  return {
    title: cleanText(article.title || document.title || "Untitled source"),
    byline: article.byline ? cleanText(article.byline) : null,
    publishedAt: published,
    text,
    warnings: text.length < 500 ? ["thin_extraction"] : [],
  };
}

async function tweetFullText(url, fallback) {
  try {
    const r = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`oembed ${r.status}`);
    const j = await r.json();
    const { document } = parseHTML(`<div>${j.html}</div>`);
    const text = cleanText(document.querySelector("blockquote p")?.textContent || "");
    if (text.length > (fallback?.length || 0)) return { text, author: j.author_name || null };
    return { text: fallback, author: j.author_name || null };
  } catch {
    return { text: fallback, author: null };
  }
}

// ---------- manifest (personal data lives outside git) ----------
const manifestPath = process.argv[2] || path.join(repoRoot, "scripts", "data", "staged-import.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const articles = manifest.articles;
const tweets = manifest.tweets;
const emails = manifest.emails.map((e) => ({ ...e, file: path.join(manifest.toolResultsDir, manifest.emailFilePattern.replace("{id}", e.threadId)) }));
// ---------- import machinery ----------
const sha256 = (v) => createHash("sha256").update(v).digest("hex");

function emailBody(file) {
  const thread = JSON.parse(readFileSync(file, "utf8"));
  const best = thread.messages.reduce((a, b) => ((b.plaintextBody?.length || 0) > (a.plaintextBody?.length || 0) ? b : a));
  return cleanText(best.plaintextBody || "");
}

async function importItem({ canonical, title, saved, why, getContent }) {
  const hash = sha256(canonical);
  const { data: existing } = await supabase.from("sources").select("id").eq("user_id", USER_ID).eq("content_hash", hash).maybeSingle();
  if (existing) return { canonical, status: "skipped_duplicate" };

  const { data: source, error: insertError } = await supabase
    .from("sources")
    .insert({ user_id: USER_ID, source_type: "url", title, canonical_url: canonical, content_hash: hash, why_saved: why || null, status: "processing", saved_at: new Date(saved + "T12:00:00Z").toISOString() })
    .select("id")
    .single();
  if (insertError || !source) return { canonical, status: "insert_failed", error: insertError?.message };

  try {
    const { text, finalTitle, byline, publishedAt, warnings } = await getContent();
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("No chunks produced.");
    const [enrichment, embeddings] = await Promise.all([
      enrichArticle({ title: finalTitle, url: canonical, text, extractionWarnings: warnings }),
      embedTexts(chunks.map((c) => c.text)),
    ]);
    if (embeddings.length !== chunks.length) throw new Error("Embedding/chunk count mismatch.");

    let err;
    ({ error: err } = await supabase.from("source_chunks").insert(chunks.map((c, i) => ({ source_id: source.id, user_id: USER_ID, chunk_index: c.chunkIndex, text: c.text, start_offset: c.startOffset, end_offset: c.endOffset, embedding: embeddings[i] }))));
    if (err) throw err;

    ({ error: err } = await supabase.from("source_metadata").upsert({ source_id: source.id, user_id: USER_ID, summary: enrichment.summary, key_claims: enrichment.key_claims, topics: enrichment.topics, entities: enrichment.entities, content_type: enrichment.content_type, reading_time_minutes: enrichment.reading_time_minutes, warnings: [...new Set([...warnings, ...enrichment.warnings])], model_name: MODEL }, { onConflict: "source_id" }));
    if (err) throw err;

    ({ error: err } = await supabase.from("sources").update({ title: finalTitle, extracted_text: text, author: byline, published_at: publishedAt, status: "ready", processing_error: null }).eq("id", source.id));
    if (err) throw err;

    return { canonical, status: "ready", title: finalTitle };
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1000);
    await supabase.from("sources").update({ status: "failed", processing_error: msg }).eq("id", source.id);
    return { canonical, status: "failed", error: msg };
  }
}

// ---------- run ----------
const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers();
if (usersError) throw usersError;
const user = usersPage.users.find((u) => u.email === "rossgarlick@gmail.com");
if (!user) throw new Error("rossgarlick@gmail.com not found in auth users");
const USER_ID = user.id;
console.log(`user: ${USER_ID}`);

const results = [];
for (const a of articles) {
  console.log(`[article] ${a.url}`);
  results.push(await importItem({
    canonical: a.url, title: new URL(a.url).hostname, saved: a.saved, why: a.why,
    getContent: async () => {
      const ex = await extractArticle(a.url);
      return { text: ex.text, finalTitle: ex.title, byline: ex.byline, publishedAt: ex.publishedAt, warnings: ex.warnings };
    },
  }));
  console.log(`  -> ${JSON.stringify(results.at(-1))}`);
}

for (const e of emails) {
  console.log(`[email] ${e.title}`);
  results.push(await importItem({
    canonical: e.canonical, title: e.title, saved: e.saved, why: e.why,
    getContent: async () => {
      const text = emailBody(e.file);
      if (text.length < 100) throw new Error("Email body too short.");
      return { text, finalTitle: e.title, byline: null, publishedAt: new Date(e.saved + "T12:00:00Z").toISOString(), warnings: ["imported_from_email"] };
    },
  }));
  console.log(`  -> ${JSON.stringify(results.at(-1))}`);
}

for (const t of tweets) {
  console.log(`[tweet] ${t.url}`);
  results.push(await importItem({
    canonical: t.url, title: `${t.handle} on X`, saved: t.saved, why: `Saved to X bookmarks ${t.saved}.`,
    getContent: async () => {
      const { text, author } = await tweetFullText(t.url, t.text);
      if (!text || text.length < 10) throw new Error("No tweet text available.");
      const firstLine = text.split("\n")[0];
      return {
        text: `Tweet by ${t.name} (${t.handle}), ${t.saved}:\n\n${text}`,
        finalTitle: `${t.handle}: ${firstLine.slice(0, 70)}${firstLine.length > 70 ? "…" : ""}`,
        byline: author || t.name,
        publishedAt: new Date(t.saved + "T12:00:00Z").toISOString(),
        warnings: ["imported_from_x_bookmarks"],
      };
    },
  }));
  console.log(`  -> ${JSON.stringify(results.at(-1))}`);
}

const tally = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
console.log("\n==== SUMMARY ====");
console.log(JSON.stringify(tally));
for (const r of results.filter((r) => r.status !== "ready")) console.log(JSON.stringify(r));
