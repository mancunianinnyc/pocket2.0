// Import a single URL into the library with an optional why_saved note.
//   node scripts/import-url.mjs <url> ["why saved note"]
// Same pipeline mirror as import-staged.mjs (extract -> chunk -> enrich -> embed).
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

const [url, why] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/import-url.mjs <url> ["why saved note"]');
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

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

const enrichmentResponseSchema = z.object({
  summary: z.string().min(1),
  key_claims: z.array(z.string().min(1)),
  topics: z.array(z.string().min(1)),
  entities: z.array(z.object({ name: z.string().min(1), type: z.enum(["person", "company", "place", "concept"]) })),
  content_type: z.string().min(1),
  reading_time_minutes: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1)),
});

function cleanText(v) {
  return v.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = usersPage.users.find((u) => u.email === "rossgarlick@gmail.com");
  if (!user) throw new Error("user not found");

  const canonical = url;
  const hash = createHash("sha256").update(canonical).digest("hex");
  const { data: existing } = await supabase.from("sources").select("id, status").eq("user_id", user.id).eq("content_hash", hash).maybeSingle();
  if (existing) {
    console.log(`already saved (${existing.status}): ${existing.id}`);
    return;
  }

  const res = await fetch(canonical, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "PersonalLibrary/0.1 (+https://github.com/mancunianinnyc/personal-library)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { document } = parseHTML(await res.text());
  const published = (() => {
    for (const sel of ['meta[property="article:published_time"]', 'meta[name="date"]', "time[datetime]"]) {
      const el = document.querySelector(sel);
      const v = el?.getAttribute("content") || el?.getAttribute("datetime");
      if (v && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
    }
    return null;
  })();
  const article = new Readability(document, { charThreshold: 100 }).parse();
  if (!article?.content) throw new Error("No readable content.");
  const readable = parseHTML(article.content).document;
  const blocks = Array.from(readable.querySelectorAll("h1, h2, h3, p, blockquote, li, pre")).map((e) => cleanText(e.textContent ?? "")).filter(Boolean);
  const text = cleanText(blocks.join("\n\n") || article.textContent || "");
  if (text.length < 100) throw new Error("Not enough readable text.");
  const title = cleanText(article.title || document.title || "Untitled source");
  const warnings = text.length < 500 ? ["thin_extraction"] : [];

  const { data: source, error: insertError } = await supabase
    .from("sources")
    .insert({ user_id: user.id, source_type: "url", title, canonical_url: canonical, content_hash: hash, why_saved: why || null, status: "processing" })
    .select("id")
    .single();
  if (insertError) throw insertError;

  try {
    const chunks = chunkText(text);
    const [message, embeddings] = await Promise.all([
      anthropic.messages.parse({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: "adaptive" },
        output_config: { format: zodOutputFormat(enrichmentResponseSchema) },
        system:
          "You organize a private reading library. Extract only facts supported by the supplied article. Never invent missing metadata. Keep summaries calm, specific, and useful for later retrieval. Topic labels must be lowercase. Limits: at most 8 key claims, 6 topics, 15 entities, 10 warnings; summary under 1200 characters.",
        messages: [{ role: "user", content: `Title: ${title}\nURL: ${canonical}\nExtraction warnings: ${warnings.join(", ") || "none"}\n\nArticle:\n${text.slice(0, 50000)}` }],
      }),
      (async () => {
        const out = [];
        for (let i = 0; i < chunks.length; i += 100) {
          const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: chunks.slice(i, i + 100).map((c) => c.text), encoding_format: "float" });
          out.push(...r.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
        }
        return out;
      })(),
    ]);
    if (!message.parsed_output) throw new Error("No structured enrichment output.");
    const raw = message.parsed_output;
    const enrichment = {
      summary: raw.summary.slice(0, 1200),
      key_claims: raw.key_claims.slice(0, 8).map((c) => c.slice(0, 500)),
      topics: raw.topics.slice(0, 6).map((t) => t.slice(0, 60).toLowerCase()),
      entities: raw.entities.slice(0, 15).map((e) => ({ ...e, name: e.name.slice(0, 120) })),
      content_type: raw.content_type.slice(0, 80),
      reading_time_minutes: Math.min(raw.reading_time_minutes, 999),
      warnings: raw.warnings.slice(0, 10).map((w) => w.slice(0, 120)),
    };

    let err;
    ({ error: err } = await supabase.from("source_chunks").insert(chunks.map((c, i) => ({ source_id: source.id, user_id: user.id, chunk_index: c.chunkIndex, text: c.text, start_offset: c.startOffset, end_offset: c.endOffset, embedding: embeddings[i] }))));
    if (err) throw err;
    ({ error: err } = await supabase.from("source_metadata").upsert({ source_id: source.id, user_id: user.id, summary: enrichment.summary, key_claims: enrichment.key_claims, topics: enrichment.topics, entities: enrichment.entities, content_type: enrichment.content_type, reading_time_minutes: enrichment.reading_time_minutes, warnings: [...new Set([...warnings, ...enrichment.warnings])], model_name: MODEL }, { onConflict: "source_id" }));
    if (err) throw err;
    ({ error: err } = await supabase.from("sources").update({ title, extracted_text: text, author: article.byline ? cleanText(article.byline) : null, published_at: published, status: "ready", processing_error: null }).eq("id", source.id));
    if (err) throw err;
    console.log(`READY: ${title} (${source.id})`);
    console.log(`summary: ${enrichment.summary.slice(0, 300)}`);
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await supabase.from("sources").update({ status: "failed", processing_error: msg }).eq("id", source.id);
    throw error;
  }
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
