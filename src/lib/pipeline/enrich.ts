import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/env";

// Length/size caps are enforced by normalizeEnrichment below, not by the parse
// schema: the API strips maxLength/maxItems from the schema it sends, so the
// model can exceed them and a strict client-side parse would hard-fail the item.
const enrichmentResponseSchema = z.object({
  summary: z.string().min(1),
  key_claims: z.array(z.string().min(1)),
  topics: z.array(z.string().min(1)),
  entities: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(["person", "company", "place", "concept"]),
    }),
  ),
  content_type: z.string().min(1),
  reading_time_minutes: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1)),
});

const enrichmentSchema = z.object({
  summary: z.string().min(1).max(1200),
  key_claims: z.array(z.string().min(1).max(500)).max(8),
  topics: z.array(z.string().min(1).max(60)).max(6),
  entities: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        type: z.enum(["person", "company", "place", "concept"]),
      }),
    )
    .max(15),
  content_type: z.string().min(1).max(80),
  reading_time_minutes: z.number().int().nonnegative().max(999),
  warnings: z.array(z.string().min(1).max(120)).max(10),
});

function normalizeEnrichment(
  raw: z.infer<typeof enrichmentResponseSchema>,
): Enrichment {
  return enrichmentSchema.parse({
    summary: raw.summary.slice(0, 1200),
    key_claims: raw.key_claims.slice(0, 8).map((c) => c.slice(0, 500)),
    topics: raw.topics.slice(0, 6).map((t) => t.slice(0, 60)),
    entities: raw.entities
      .slice(0, 15)
      .map((e) => ({ ...e, name: e.name.slice(0, 120) })),
    content_type: raw.content_type.slice(0, 80),
    reading_time_minutes: Math.min(raw.reading_time_minutes, 999),
    warnings: raw.warnings.slice(0, 10).map((w) => w.slice(0, 120)),
  });
}

let anthropicClient: Anthropic | undefined;

function getAnthropicClient() {
  anthropicClient ??= new Anthropic({ apiKey: getAnthropicApiKey() });
  return anthropicClient;
}

export type Enrichment = z.infer<typeof enrichmentSchema>;

export async function enrichArticle(input: {
  title: string;
  url: string;
  text: string;
  extractionWarnings: string[];
}) {
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  const message = await getAnthropicClient().messages.parse({
    model,
    max_tokens: 3_000,
    thinking: { type: "adaptive" },
    output_config: {
      format: zodOutputFormat(enrichmentResponseSchema),
    },
    system:
      "You organize a private reading library. Extract only facts supported by the supplied article. Never invent missing metadata. Keep summaries calm, specific, and useful for later retrieval. Topic labels must be lowercase. Limits: at most 8 key claims, 6 topics, 15 entities, 10 warnings; summary under 1200 characters.",
    messages: [
      {
        role: "user",
        content: `Title: ${input.title}\nURL: ${input.url}\nExtraction warnings: ${input.extractionWarnings.join(", ") || "none"}\n\nArticle:\n${input.text.slice(0, 50_000)}`,
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("The enrichment model returned no structured output.");
  }

  return { enrichment: normalizeEnrichment(message.parsed_output), model };
}
