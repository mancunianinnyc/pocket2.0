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

/** ISO 8601 duration ("PT53M26S") → whole minutes, minimum 1. */
function parseIsoDurationMinutes(value: string | undefined) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const seconds =
    Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

/**
 * The official Data API is the only YouTube surface that reliably answers
 * datacenter IPs — every anonymous innertube client gets the
 * "sign in to confirm you're not a bot" gate from Vercel. Free tier covers
 * 10,000 lookups/day; without YOUTUBE_API_KEY this quietly does nothing and
 * saves keep title/channel/thumbnail from oEmbed.
 */
async function fetchDataApiFacts(videoId: string): Promise<VideoFacts | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`,
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    console.warn(`[youtube] data api http ${response.status} for ${videoId}`);
    return null;
  }
  const data = (await response.json()) as {
    items?: Array<{
      snippet?: { description?: string; publishedAt?: string };
      contentDetails?: { duration?: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) return null;

  const date = item.snippet?.publishedAt;
  return {
    description: item.snippet?.description ?? "",
    publishedAt:
      date && !Number.isNaN(Date.parse(date))
        ? new Date(date).toISOString()
        : null,
    durationMinutes: parseIsoDurationMinutes(item.contentDetails?.duration),
  };
}

/**
 * Innertube client identities to try in order. Datacenter IPs (Vercel) get a
 * "sign in to confirm you're not a bot" gate on the WEB client, which returns
 * no videoDetails; the ANDROID app identity is usually exempt from that gate.
 * "UNPLAYABLE" is fine either way — it only gates streaming, not metadata.
 */
const INNERTUBE_CLIENTS = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    androidSdkVersion: 30,
    osName: "Android",
    osVersion: "11",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
  },
  {
    clientName: "MWEB",
    clientVersion: "2.20240101.00.00",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
  },
  {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    userAgent: USER_AGENT,
  },
];

async function fetchInnertubeFacts(
  videoId: string,
  client: (typeof INNERTUBE_CLIENTS)[number],
): Promise<VideoFacts | null> {
  const { userAgent, ...clientContext } = client;
  const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "content-type": "application/json", "user-agent": userAgent },
    cache: "no-store",
    body: JSON.stringify({
      videoId,
      context: { client: clientContext },
    }),
  });
  if (!response.ok) {
    console.warn(
      `[youtube] innertube ${client.clientName} http ${response.status} for ${videoId}`,
    );
    return null;
  }
  const data = (await response.json()) as {
    playabilityStatus?: { status?: string };
    videoDetails?: { shortDescription?: string; lengthSeconds?: string };
    microformat?: { playerMicroformatRenderer?: { publishDate?: string } };
  };
  const details = data.videoDetails;
  console.warn(
    `[youtube] innertube ${client.clientName} playability=${data.playabilityStatus?.status} desc=${details?.shortDescription?.length ?? 0} for ${videoId}`,
  );
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
  // Clients differ in what they surface (ANDROID skips the bot gate but omits
  // the publish date; MWEB carries it), so merge field-by-field until full.
  const merged: VideoFacts = {
    description: "",
    publishedAt: null,
    durationMinutes: null,
  };
  const absorb = (facts: VideoFacts | null) => {
    if (!facts) return;
    merged.description ||= facts.description;
    merged.publishedAt ??= facts.publishedAt;
    merged.durationMinutes ??= facts.durationMinutes;
  };
  const complete = () =>
    Boolean(merged.description && merged.publishedAt && merged.durationMinutes);

  try {
    absorb(await fetchDataApiFacts(videoId));
  } catch {
    // Fall through to innertube.
  }
  for (const client of INNERTUBE_CLIENTS) {
    if (complete()) break;
    try {
      absorb(await fetchInnertubeFacts(videoId, client));
    } catch {
      // Try the next client.
    }
  }
  if (!complete()) {
    try {
      absorb(await fetchWatchPageFacts(videoId));
    } catch {
      // Keep whatever the innertube clients produced.
    }
  }
  let description = merged.description;
  const publishedAt = merged.publishedAt;
  const durationMinutes = merged.durationMinutes;

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
