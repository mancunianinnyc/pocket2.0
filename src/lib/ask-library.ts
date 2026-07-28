import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/env";
import type { SearchResult } from "@/types/search";

const askSchema = z.object({
  answer: z.string().min(1).max(8_000),
  citations: z
    .array(
      z.object({
        source_id: z.string().uuid(),
        chunk_index: z.number().int().nonnegative(),
        quote: z.string().min(1).max(1_000),
      }),
    )
    .max(12),
  insufficient_evidence: z.boolean(),
});

let client: Anthropic | undefined;

function getClient() {
  client ??= new Anthropic({ apiKey: getAnthropicApiKey() });
  return client;
}

export async function answerFromEvidence(
  question: string,
  evidence: SearchResult[],
) {
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  const evidenceText = evidence
    .map(
      (item) =>
        `<evidence source_id="${item.source_id}" chunk_index="${item.chunk_index}" title="${item.title || "Untitled"}">\n${item.chunk_text}\n</evidence>`,
    )
    .join("\n\n");

  const response = await getClient().messages.parse({
    model,
    max_tokens: 4_000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(askSchema) },
    system:
      "Answer only from the supplied evidence. Cite every material factual claim. Every quote must be copied exactly from its cited evidence chunk. If the evidence does not support a reliable answer, say so plainly and set insufficient_evidence to true. Do not use outside knowledge.",
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\nEvidence:\n${evidenceText || "(none)"}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("The answer model returned no structured output.");
  }

  const validCitations = response.parsed_output.citations.filter((citation) =>
    evidence.some(
      (item) =>
        item.source_id === citation.source_id &&
        item.chunk_index === citation.chunk_index &&
        item.chunk_text.includes(citation.quote),
    ),
  );

  return {
    answer: response.parsed_output.answer,
    citations: validCitations.map((citation) => ({
      ...citation,
      title:
        evidence.find((item) => item.source_id === citation.source_id)?.title ||
        "Untitled source",
    })),
    insufficient_evidence:
      response.parsed_output.insufficient_evidence ||
      (evidence.length === 0 && validCitations.length === 0),
    model,
  };
}
