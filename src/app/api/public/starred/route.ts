import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The public reading feed for rossgarlick.com/what-im-reading.
 *
 * Unauthenticated by design, so the column list below is the entire security
 * boundary: only starred rows, and never `extracted_text`. Keeping a full
 * private copy of someone else's article is fine; serving it is republishing.
 * Add a column here only if it is meant to be world-readable.
 */
const PUBLIC_COLUMNS =
  "id, title, canonical_url, author, published_at, starred_at, public_blurb, favicon_url, source_metadata(summary, topics, reading_time_minutes)";

function domain(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  const { data, error } = await getAdminClient()
    .from("sources")
    .select(PUBLIC_COLUMNS)
    .not("starred_at", "is", null)
    .eq("status", "ready")
    .order("starred_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Could not load the feed." }, { status: 500 });
  }

  const items = (data ?? []).map((row) => {
    const metadata = Array.isArray(row.source_metadata)
      ? row.source_metadata[0]
      : row.source_metadata;
    return {
      id: row.id,
      title: row.title,
      url: row.canonical_url,
      domain: domain(row.canonical_url),
      // Serve https so the icon is never blocked as mixed content on the
      // consuming page; some sites still declare their icon over http.
      favicon_url: row.favicon_url?.replace(/^http:\/\//, "https://") ?? null,
      author: row.author,
      published_at: row.published_at,
      starred_at: row.starred_at,
      // The generated one-liner; the full summary is the fallback for items
      // starred before a blurb existed.
      blurb: row.public_blurb || metadata?.summary || null,
      topics: metadata?.topics ?? [],
      reading_time_minutes: metadata?.reading_time_minutes ?? null,
    };
  });

  return NextResponse.json(
    { count: items.length, items },
    {
      headers: {
        // Site builds and any browser fetch can cache; a star reaches the page
        // on the next build anyway.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
