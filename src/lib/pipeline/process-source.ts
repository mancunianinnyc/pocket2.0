import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import { enrichArticle } from "./enrich";
import { extractUrl } from "./extract";

function safeErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown processing error.";
  return message.replace(/\s+/g, " ").slice(0, 1_000);
}

export async function processSource(sourceId: string, userId: string) {
  const admin = getAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("sources")
    .select("id, user_id, source_type, canonical_url")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sourceError || !source) {
    throw new Error("Source not found.");
  }
  if (source.source_type !== "url" || !source.canonical_url) {
    throw new Error("Only URL processing is available in this slice.");
  }

  await admin
    .from("sources")
    .update({ status: "processing", processing_error: null })
    .eq("id", sourceId)
    .eq("user_id", userId);

  try {
    const extracted = await extractUrl(source.canonical_url);
    const chunks = chunkText(extracted.text);
    if (!chunks.length) throw new Error("The article could not be chunked.");

    const [{ enrichment, model }, embeddings] = await Promise.all([
      enrichArticle({
        title: extracted.title,
        url: extracted.canonicalUrl,
        text: extracted.text,
        extractionWarnings: extracted.warnings,
      }),
      embedTexts(chunks.map((chunk) => chunk.text)),
    ]);

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding count did not match the article chunks.");
    }

    const { error: deleteError } = await admin
      .from("source_chunks")
      .delete()
      .eq("source_id", sourceId)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;

    const { error: chunkError } = await admin.from("source_chunks").insert(
      chunks.map((chunk, index) => ({
        source_id: sourceId,
        user_id: userId,
        chunk_index: chunk.chunkIndex,
        text: chunk.text,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
        embedding: embeddings[index],
      })),
    );
    if (chunkError) throw chunkError;

    const warnings = Array.from(
      new Set([...extracted.warnings, ...enrichment.warnings]),
    );
    const { error: metadataError } = await admin.from("source_metadata").upsert(
      {
        source_id: sourceId,
        user_id: userId,
        summary: enrichment.summary,
        key_claims: enrichment.key_claims,
        topics: enrichment.topics.map((topic) => topic.toLowerCase()),
        entities: enrichment.entities,
        content_type: enrichment.content_type,
        reading_time_minutes: enrichment.reading_time_minutes,
        warnings,
        model_name: model,
      },
      { onConflict: "source_id" },
    );
    if (metadataError) throw metadataError;

    const { data: readySource, error: updateError } = await admin
      .from("sources")
      .update({
        title: extracted.title,
        canonical_url: extracted.canonicalUrl,
        favicon_url: extracted.faviconUrl,
        extracted_text: extracted.text,
        author: extracted.byline,
        published_at: extracted.publishedAt,
        status: "ready",
        processing_error: null,
      })
      .eq("id", sourceId)
      .eq("user_id", userId)
      .select("id, status, title")
      .single();
    if (updateError) throw updateError;

    return readySource;
  } catch (error) {
    const processingError = safeErrorMessage(error);
    await admin
      .from("sources")
      .update({ status: "failed", processing_error: processingError })
      .eq("id", sourceId)
      .eq("user_id", userId);
    throw new Error(processingError);
  }
}
