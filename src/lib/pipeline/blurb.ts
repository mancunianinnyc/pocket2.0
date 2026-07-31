import "server-only";

import { z } from "zod";
import { generateStructured } from "@/lib/llm";

/** Hard ceiling for the published line — two comfortable lines on a phone. */
export const BLURB_MAX_CHARS = 160;

// Parse schema stays loose for the same reason as enrich.ts: the API strips
// maxLength before the model sees it, so a strict parse would hard-fail a
// blurb that runs a few characters long. Clamp after parsing instead.
const blurbResponseSchema = z.object({
  blurb: z.string().min(1),
});

/** Trim to the last whole word inside the limit rather than cutting mid-word. */
function clamp(text: string) {
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= BLURB_MAX_CHARS) return single;
  const cut = single.slice(0, BLURB_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * One publishable line for a starred source. Written from the stored summary,
 * so this never refetches the article and costs one short call.
 */
export async function generateBlurb(input: {
  title: string;
  summary: string;
  author?: string | null;
  contentType?: string | null;
}) {
  const { data } = await generateStructured({
    name: "public_blurb",
    schema: blurbResponseSchema,
    maxTokens: 1_000,
    system: [
      "You write the one-line note that sits under a link on someone's personal reading page.",
      // Aim well under the clamp: a line that gets truncated ends in an
      // ellipsis, which reads like a bug on a published page.
      `Aim for 100-130 characters and never exceed ${BLURB_MAX_CHARS}. One sentence. Shorter is better.`,
      "Say what the piece argues or shows — the substance a reader would want before clicking.",
      "Never open with meta framing like 'This article', 'A tweet by', 'The author argues', or the publication name.",
      "Never invent anything absent from the supplied summary. Plain sentence case, no quotation marks, no trailing ellipsis.",
    ].join(" "),
    user: [
      `Title: ${input.title}`,
      input.author ? `Author: ${input.author}` : null,
      input.contentType ? `Type: ${input.contentType}` : null,
      "",
      `Summary:
${input.summary.slice(0, 4_000)}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  });

  return clamp(data.blurb);
}
