// Write the public one-liner for any starred source that is missing one —
// e.g. when generation failed transiently at star time.
//   node scripts/backfill-blurbs.mjs [--force]
// Mirrors src/lib/pipeline/blurb.ts (kept a copy so this stays a plain node file).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BLURB_MAX_CHARS = 160;
const force = process.argv.includes("--force");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const schema = z.object({ blurb: z.string().min(1) });

function clamp(text) {
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= BLURB_MAX_CHARS) return single;
  const cut = single.slice(0, BLURB_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

const { data, error } = await db
  .from("sources")
  .select("id, title, author, public_blurb, source_metadata(summary, content_type)")
  .not("starred_at", "is", null)
  .order("starred_at", { ascending: false });
if (error) throw new Error(error.message);

const pending = (data ?? []).filter((s) => force || !s.public_blurb);
console.log(`${pending.length} starred source(s) need a blurb\n`);

for (const source of pending) {
  const metadata = Array.isArray(source.source_metadata)
    ? source.source_metadata[0]
    : source.source_metadata;
  if (!metadata?.summary) {
    console.log(`- ${source.title}: no summary to write from, skipped`);
    continue;
  }

  try {
    const message = await anthropic.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
      max_tokens: 1_000,
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(schema), effort: "low" },
      system:
        "You write the one-line note that sits under a link on someone's personal reading page. " +
        `Aim for 100-130 characters and never exceed ${BLURB_MAX_CHARS}. One sentence. Shorter is better. ` +
        "Say what the piece argues or shows — the substance a reader would want before clicking. " +
        "Never open with meta framing like 'This article', 'A tweet by', 'The author argues', or the publication name. " +
        "Never invent anything absent from the supplied summary. Plain sentence case, no quotation marks, no trailing ellipsis.",
      messages: [
        {
          role: "user",
          content: [
            `Title: ${source.title}`,
            source.author ? `Author: ${source.author}` : null,
            metadata.content_type ? `Type: ${metadata.content_type}` : null,
            "",
            `Summary:\n${metadata.summary.slice(0, 4_000)}`,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        },
      ],
    });

    if (!message.parsed_output) throw new Error("no structured output");
    const blurb = clamp(message.parsed_output.blurb);
    const { error: updateError } = await db
      .from("sources")
      .update({ public_blurb: blurb })
      .eq("id", source.id);
    if (updateError) throw new Error(updateError.message);
    console.log(`✓ ${source.title}\n  ${blurb}\n`);
  } catch (caught) {
    console.log(`✗ ${source.title}: ${caught.message}\n`);
  }
}
