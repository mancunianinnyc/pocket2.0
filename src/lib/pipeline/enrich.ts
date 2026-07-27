import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/env";

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
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const message = await getAnthropicClient().messages.parse({
    model,
    max_tokens: 3_000,
    thinking: { type: "adaptive" },
    output_config: {
      format: zodOutputFormat(enrichmentSchema),
    },
    system:
      "You organize a private reading library. Extract only facts supported by the supplied article. Never invent missing metadata. Keep summaries calm, specific, and useful for later retrieval. Topic labels must be lowercase.",
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

  return { enrichment: message.parsed_output, model };
}
