import "server-only";

import { generateStructured } from "@/lib/llm";
import { z } from "zod";
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


export async function answerFromEvidence(
  question: string,
  evidence: SearchResult[],
) {
  const evidenceText = evidence
    .map(
      (item) =>
        `<evidence source_id="${item.source_id}" chunk_index="${item.chunk_index}" title="${item.title || "Untitled"}">\n${item.chunk_text}\n</evidence>`,
    )
    .join("\n\n");

  const { data: parsed, model } = await generateStructured({
    name: "library_answer",
    schema: askSchema,
    maxTokens: 4_000,
    system:
      "Answer only from the supplied evidence. Cite every material factual claim. Every quote must be copied exactly from its cited evidence chunk. If the evidence does not support a reliable answer, say so plainly and set insufficient_evidence to true. Do not use outside knowledge.",
    user: `Question: ${question}\n\nEvidence:\n${evidenceText || "(none)"}`,
  });

  const validCitations = parsed.citations.filter((citation) =>
    evidence.some(
      (item) =>
        item.source_id === citation.source_id &&
        item.chunk_index === citation.chunk_index &&
        item.chunk_text.includes(citation.quote),
    ),
  );

  return {
    answer: parsed.answer,
    citations: validCitations.map((citation) => ({
      ...citation,
      title:
        evidence.find((item) => item.source_id === citation.source_id)?.title ||
        "Untitled source",
    })),
    insufficient_evidence:
      parsed.insufficient_evidence ||
      (evidence.length === 0 && validCitations.length === 0),
    model,
  };
}
