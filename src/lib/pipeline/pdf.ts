import "server-only";

import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { ExtractedArticle } from "./extract";

/** PDF info dates look like `D:20260805064602Z00'00'`. */
function parsePdfDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}

/** "Ribbit-Power-Letter-July-2026-vFinal.pdf" → "Ribbit Power Letter July 2026 vFinal". */
function titleFromFilename(url: URL) {
  const segment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  let name: string;
  try {
    name = decodeURIComponent(segment);
  } catch {
    name = segment;
  }
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPdfText(value: string) {
  return value
    .replace(/­/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function metaString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * PDFs reached by URL — most often a Dropbox share of an investor letter or
 * paper. `canonicalUrl` stays the share link the user saved, never the
 * ephemeral `dl.dropboxusercontent.com` address the bytes came from.
 */
export async function extractPdf(
  bytes: Uint8Array,
  originalUrl: URL,
): Promise<ExtractedArticle> {
  const pdf = await getDocumentProxy(bytes);
  const meta = await getMeta(pdf).catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;

  const { text: rawText } = await extractText(pdf, { mergePages: true });
  const text = cleanPdfText(rawText);
  if (text.length < 100) {
    throw new Error(
      "That PDF has no extractable text — it may be a scan without OCR.",
    );
  }

  const title =
    metaString(info.Title) ?? titleFromFilename(originalUrl) ?? "Untitled PDF";

  return {
    title,
    byline: metaString(info.Author),
    publishedAt: parsePdfDate(info.CreationDate),
    canonicalUrl: originalUrl.toString(),
    text,
    faviconUrl: `${originalUrl.origin}/favicon.ico`,
    warnings: text.length < 500 ? ["thin_extraction"] : [],
  };
}
