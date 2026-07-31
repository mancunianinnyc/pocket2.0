import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";
import { getAnthropicApiKey, getOpenAiApiKey } from "@/lib/env";

/**
 * One structured-output call, either provider.
 *
 * The library's three model calls — enrichment, public blurbs, and answering
 * questions — all want the same thing: a JSON object matching a Zod schema.
 * Keeping that in one place means switching providers is an env change rather
 * than three rewrites.
 */
export const DEFAULT_MODEL = process.env.LLM_MODEL?.trim() || "gpt-5.6-luna";

function providerFor(model: string) {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "openai" || forced === "anthropic") return forced;
  return model.startsWith("claude") ? "anthropic" : "openai";
}

let openAiClient: OpenAI | undefined;
let anthropicClient: Anthropic | undefined;

/**
 * OpenAI's strict mode requires every object to close itself and list every
 * property as required; Zod's JSON Schema output does neither by default.
 */
function toStrictJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrictJsonSchema);
  if (!node || typeof node !== "object") return node;

  const source = node as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    output[key] = toStrictJsonSchema(value);
  }

  if (output.type === "object") {
    output.additionalProperties = false;
    const properties = output.properties as Record<string, unknown> | undefined;
    if (properties) output.required = Object.keys(properties);
  }
  return output;
}

export type StructuredCall<T> = {
  /** Schema name sent to the provider; lowercase identifier. */
  name: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
};

export async function generateStructured<T>({
  name,
  schema,
  system,
  user,
  maxTokens = 3_000,
}: StructuredCall<T>): Promise<{ data: T; model: string }> {
  const model = DEFAULT_MODEL;

  if (providerFor(model) === "anthropic") {
    anthropicClient ??= new Anthropic({ apiKey: getAnthropicApiKey() });
    const message = await anthropicClient.messages.parse({
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (!message.parsed_output) {
      throw new Error(`The ${name} model returned no structured output.`);
    }
    return { data: message.parsed_output as T, model };
  }

  openAiClient ??= new OpenAI({ apiKey: getOpenAiApiKey() });
  const response = await openAiClient.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        // z.toJSONSchema targets draft 2020-12; strict mode wants the closed
        // form, hence the rewrite above.
        schema: toStrictJsonSchema(
          z.toJSONSchema(schema, { io: "output" }),
        ) as Record<string, unknown>,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`The ${name} model returned no structured output.`);
  }
  return { data: schema.parse(JSON.parse(content)) as T, model };
}
