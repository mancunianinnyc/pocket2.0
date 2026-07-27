import "server-only";

import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/env";

const EMBEDDING_BATCH_SIZE = 100;
let openAiClient: OpenAI | undefined;

function getOpenAiClient() {
  openAiClient ??= new OpenAI({ apiKey: getOpenAiApiKey() });
  return openAiClient;
}

export async function embedTexts(texts: string[]) {
  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const response = await getOpenAiClient().embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
      encoding_format: "float",
    });
    embeddings.push(
      ...response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding),
    );
  }

  return embeddings;
}
