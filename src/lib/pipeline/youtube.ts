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

type VideoFacts = {
  description: string;
  publishedAt: string | null;
  durationMinutes: number | null;
};

/**
 * The innertube player endpoint is what YouTube's own web client calls, and it
 * answers from datacenter IPs (Vercel) where the watch page comes back
 * stripped of its player payload. "UNPLAYABLE" only means the anonymous
 * client can't stream — the metadata is still complete.
 */
async function fetchInnertubeFacts(videoId: string): Promise<VideoFacts | null> {
  const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    cache: "no-store",
    body: JSON.stringify({
      videoId,
      context: {
        client: { clientName: "WEB", clientVersion: "2.20240101.00.00" },
      },
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    videoDetails?: { shortDescription?: string; lengthSeconds?: string };
    microformat?: { playerMicroformatRenderer?: { publishDate?: string } };
  };
  const details = data.videoDetails;
  if (!details) return null;

  const date = data.microformat?.playerMicroformatRenderer?.publishDate;
  const seconds = Number(details.lengthSeconds);
  return {
    description: details.shortDescription ?? "",
    publishedAt:
      date && !Number.isNaN(Date.parse(date))
        ? new Date(date).toISOString()
        : null,
    durationMinutes:
      Number.isFinite(seconds) && seconds > 0
        ? Math.max(1, Math.round(seconds / 60))
        : null,
  };
}

/** Scrape the watch page's initial payload — the fallback when innertube shifts. */
async function fetchWatchPageFacts(videoId: string): Promise<VideoFacts | null> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = (await response.text()).slice(0, 3_000_000);

  let description = "";
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
  const seconds = Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1]);
  return {
    description,
    publishedAt:
      date && !Number.isNaN(Date.parse(date))
        ? new Date(date).toISOString()
        : null,
    durationMinutes:
      Number.isFinite(seconds) && seconds > 0
        ? Math.max(1, Math.round(seconds / 60))
        : null,
  };
}

/**
 * Watch pages are all client-rendered JavaScript, so Readability finds nothing
 * on them. YouTube's own metadata is enough for the library: oEmbed carries
 * title, channel, and thumbnail with no API key; innertube (with the watch
 * page as fallback) carries the description, publish date, and duration.
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

  // Everything past oEmbed is gravy — a blocked or reshaped source must never
  // fail the save.
  let facts: VideoFacts | null = null;
  try {
    facts = await fetchInnertubeFacts(videoId);
  } catch {
    // Try the watch page instead.
  }
  if (!facts?.description) {
    try {
      facts = (await fetchWatchPageFacts(videoId)) ?? facts;
    } catch {
      // Keep whatever innertube produced, or the oEmbed-only result.
    }
  }
  let description = facts?.description ?? "";
  const publishedAt = facts?.publishedAt ?? null;
  const durationMinutes = facts?.durationMinutes ?? null;

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
