import "server-only";

import type { ExtractedArticle } from "./extract";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "GoodContent/0.2 (+https://github.com/mancunianinnyc/pocket2.0)";

const SPOTIFY_TYPES = new Set([
  "episode",
  "show",
  "track",
  "album",
  "playlist",
]);

export type SpotifyRef = { type: string; id: string };

export function getSpotifyRef(input: string | null): SpotifyRef | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^www\./, "") !== "open.spotify.com") return null;

  // Paths may carry a locale prefix: /intl-es/episode/<id>.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.startsWith("intl-")) segments.shift();
  const [type, id] = segments;
  if (!type || !SPOTIFY_TYPES.has(type)) return null;
  if (!id || !/^[A-Za-z0-9]{10,30}$/.test(id)) return null;
  return { type, id };
}

export type ExtractedSpotify = ExtractedArticle & {
  thumbnailUrl: string | null;
  durationMinutes: number | null;
};

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

function metaContent(html: string, property: string) {
  const tag = html.match(
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${property}["'][^>]*>`, "i"),
  )?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

type OEmbedResponse = { title?: string; thumbnail_url?: string };

/**
 * Spotify pages are a player app, so Readability drowns in UI chrome — but
 * they serve Open Graph tags statically (link unfurling depends on it), and
 * the keyless oEmbed endpoint backs them up for title and cover art.
 */
export async function extractSpotify(ref: SpotifyRef): Promise<ExtractedSpotify> {
  const canonicalUrl = `https://open.spotify.com/${ref.type}/${ref.id}`;

  let title: string | null = null;
  let description = "";
  let thumbnailUrl: string | null = null;
  let publishedAt: string | null = null;
  let durationMinutes: number | null = null;

  try {
    const pageResponse = await fetch(canonicalUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": USER_AGENT,
      },
      cache: "no-store",
    });
    if (pageResponse.ok) {
      const html = (await pageResponse.text()).slice(0, 2_000_000);
      title = metaContent(html, "og:title");
      description = metaContent(html, "og:description") ?? "";
      thumbnailUrl = metaContent(html, "og:image");

      const releaseDate = metaContent(html, "music:release_date");
      if (releaseDate && !Number.isNaN(Date.parse(releaseDate))) {
        publishedAt = new Date(releaseDate).toISOString();
      }
      const seconds = Number(metaContent(html, "music:duration"));
      if (Number.isFinite(seconds) && seconds > 0) {
        durationMinutes = Math.max(1, Math.round(seconds / 60));
      }
    }
  } catch {
    // The oEmbed fallback below still identifies the item.
  }

  if (!title || !thumbnailUrl) {
    const oembedResponse = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        cache: "no-store",
      },
    );
    if (oembedResponse.ok) {
      const oembed = (await oembedResponse.json()) as OEmbedResponse;
      title ||= oembed.title?.trim() || null;
      thumbnailUrl ||= oembed.thumbnail_url ?? null;
    }
  }

  if (!title) {
    throw new Error(
      "Spotify would not describe that link — it may be private or removed.",
    );
  }

  // Episode descriptions read "The Show Name · Episode" — the show is the byline.
  const byline =
    ref.type === "episode"
      ? (description.match(/^(.+?) · Episode$/)?.[1]?.trim() ?? null)
      : null;

  const noun = ref.type === "episode" ? "podcast episode" : ref.type;
  const text = [
    title,
    byline ? `A Spotify ${noun} from ${byline}.` : `A Spotify ${noun}.`,
    description.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    byline,
    publishedAt,
    canonicalUrl,
    text,
    faviconUrl: "https://open.spotify.com/favicon.ico",
    warnings: description ? [] : ["no_spotify_description"],
    thumbnailUrl,
    durationMinutes,
  };
}
