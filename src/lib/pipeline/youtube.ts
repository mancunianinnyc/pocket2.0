import "server-only";

import type { ExtractedArticle } from "./extract";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "GoodContent/0.2 (+https://github.com/mancunianinnyc/pocket2.0)";

/** Hosts whose links are YouTube videos rather than readable articles. */
const WATCH_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com"]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeVideoId(input: string | null): string | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const candidate = url.pathname.split("/")[1] ?? "";
    return VIDEO_ID.test(candidate) ? candidate : null;
  }
  if (!WATCH_HOSTS.has(host)) return null;
  if (url.pathname === "/watch") {
    const candidate = url.searchParams.get("v") ?? "";
    return VIDEO_ID.test(candidate) ? candidate : null;
  }
  const nested = url.pathname.match(
    /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/,
  );
  return nested ? nested[1] : null;
}

export type ExtractedVideo = ExtractedArticle & {
  thumbnailUrl: string;
  /** Video length, standing in for reading time on cards. */
  durationMinutes: number | null;
};

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

function metaContent(html: string, name: string) {
  const tag = html.match(
    new RegExp(`<meta\\b[^>]*(?:name|property|itemprop)=["']${name}["'][^>]*>`, "i"),
  )?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

/**
 * Watch pages are all client-rendered JavaScript, so Readability finds nothing
 * on them. YouTube's own metadata is enough for the library: oEmbed carries
 * title, channel, and thumbnail with no API key, and the watch page's initial
 * payload carries the description, publish date, and duration.
 */
export async function extractYouTube(videoId: string): Promise<ExtractedVideo> {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const oembedResponse = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      cache: "no-store",
    },
  );
  if (!oembedResponse.ok) {
    throw new Error(
      "YouTube would not describe that video — it may be private, removed, or region-locked.",
    );
  }
  const oembed = (await oembedResponse.json()) as OEmbedResponse;
  const title = oembed.title?.trim();
  if (!title) throw new Error("YouTube returned no title for that video.");
  const author = oembed.author_name?.trim() || null;

  // Everything from the watch page is gravy on top of oEmbed — a blocked or
  // reshaped page must never fail the save.
  let description = "";
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
      const html = (await pageResponse.text()).slice(0, 3_000_000);

      const rawDescription = html.match(
        /"shortDescription":"((?:[^"\\]|\\.)*)"/,
      )?.[1];
      if (rawDescription) {
        try {
          description = JSON.parse(`"${rawDescription}"`) as string;
        } catch {
          // Fall through to the meta tag.
        }
      }
      if (!description) {
        description = metaContent(html, "description") ?? "";
      }

      const date =
        html.match(/"publishDate":"([^"]+)"/)?.[1] ??
        metaContent(html, "datePublished");
      if (date && !Number.isNaN(Date.parse(date))) {
        publishedAt = new Date(date).toISOString();
      }

      const seconds = Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        durationMinutes = Math.max(1, Math.round(seconds / 60));
      }
    }
  } catch {
    // Keep the oEmbed-only result.
  }

  description = description.trim();
  const text = [
    title,
    author ? `A YouTube video by ${author}.` : "A YouTube video.",
    description,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    byline: author,
    publishedAt,
    canonicalUrl,
    text,
    faviconUrl: "https://www.youtube.com/favicon.ico",
    warnings: description ? [] : ["no_video_description"],
    thumbnailUrl:
      oembed.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationMinutes,
  };
}
