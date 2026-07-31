import "server-only";

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { resolveFaviconUrl } from "./favicon";
import { assertPublicUrl, normalizePublicUrl } from "./url-safety";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;

export type ExtractedArticle = {
  title: string;
  byline: string | null;
  publishedAt: string | null;
  canonicalUrl: string;
  text: string;
  faviconUrl: string | null;
  warnings: string[];
};

async function readLimitedBody(response: Response) {
  if (!response.body) throw new Error("The site returned an empty response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("That page is larger than the 5 MB capture limit.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(body);
}

async function fetchWithSafeRedirects(input: string) {
  let url = normalizePublicUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicUrl(url);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "GoodContent/0.2 (+https://github.com/mancunianinnyc/pocket2.0)",
      },
      cache: "no-store",
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site returned an invalid redirect.");
      url = normalizePublicUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`The site returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      throw new Error("This link is not an HTML article.");
    }

    return { html: await readLimitedBody(response), finalUrl: url };
  }

  throw new Error("The site redirected too many times.");
}

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getPublishedAt(document: Document) {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    "time[datetime]",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value =
      element?.getAttribute("content") || element?.getAttribute("datetime");
    if (value && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }
  }

  return null;
}

/**
 * A network-level block returns HTTP 200 with a real page, so extraction
 * "succeeds" and the library silently stores the interstitial instead of the
 * article. Seven saves were lost this way to Colombia's Coljuegos block, which
 * hijacked shortener redirects during an import. Fail loudly instead.
 */
const INTERSTITIAL_SIGNATURES: Array<{ host: string; marker: string }> = [
  { host: "coljuegos.gov.co", marker: "advertencia páginas online ilegales" },
  { host: "mintic.gov.co", marker: "página bloqueada" },
];

function assertNotInterstitial(finalUrl: URL, text: string) {
  const host = finalUrl.hostname.replace(/^www\./, "");
  const haystack = text.slice(0, 2_000).toLowerCase();
  const hit = INTERSTITIAL_SIGNATURES.find(
    (signature) =>
      host.endsWith(signature.host) || haystack.includes(signature.marker),
  );
  if (hit) {
    throw new Error(
      `That link was intercepted by a network block page (${host}), so the original article could not be read. Try again from a different network.`,
    );
  }
}

export async function extractUrl(input: string): Promise<ExtractedArticle> {
  const { html, finalUrl } = await fetchWithSafeRedirects(input);
  const { document } = parseHTML(html);
  const canonicalHref = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  const publishedAt = getPublishedAt(document as unknown as Document);

  const article = new Readability(document as unknown as Document, {
    charThreshold: 100,
  }).parse();

  if (!article?.content) {
    throw new Error("We could not find readable article content on that page.");
  }

  const readable = parseHTML(article.content).document;
  const blocks = Array.from(
    readable.querySelectorAll("h1, h2, h3, p, blockquote, li, pre"),
  )
    .map((element) => cleanText(element.textContent ?? ""))
    .filter(Boolean);
  const text = cleanText(blocks.join("\n\n") || article.textContent || "");

  if (text.length < 100) {
    throw new Error("The page did not contain enough readable text.");
  }

  assertNotInterstitial(finalUrl, text);

  const warnings = text.length < 500 ? ["thin_extraction"] : [];
  let canonicalUrl = finalUrl.toString();
  if (canonicalHref) {
    try {
      const candidate = normalizePublicUrl(
        new URL(canonicalHref, finalUrl).toString(),
      );
      await assertPublicUrl(candidate);
      canonicalUrl = candidate.toString();
    } catch {
      // Keep the validated final URL when a canonical link is invalid.
    }
  }

  return {
    title: cleanText(article.title || document.title || "Untitled source"),
    byline: article.byline ? cleanText(article.byline) : null,
    publishedAt,
    canonicalUrl,
    text,
    faviconUrl: resolveFaviconUrl(html, finalUrl),
    warnings,
  };
}
