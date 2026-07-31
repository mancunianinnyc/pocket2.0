import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { processSource } from "@/lib/pipeline/process-source";
import { normalizePublicUrl } from "@/lib/pipeline/url-safety";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const createSourceSchema = z.object({
  url: z.string().url().max(8_192),
  why_saved: z.string().trim().max(2_000).optional(),
});

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .select(
      "id, source_type, title, canonical_url, author, published_at, saved_at, status, processing_error, why_saved, source_metadata(summary, topics, content_type, reading_time_minutes, warnings)",
    )
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sources: data });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof createSourceSchema>;
  try {
    input = createSourceSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a valid http or https URL." },
      { status: 400 },
    );
  }

  let normalized: URL;
  try {
    normalized = normalizePublicUrl(input.url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid URL." },
      { status: 400 },
    );
  }

  const canonicalUrl = normalized.toString();
  const contentHash = createHash("sha256")
    .update(canonicalUrl)
    .digest("hex");
  const supabase = await createClient();
  const { data: source, error: insertError } = await supabase
    .from("sources")
    .insert({
      user_id: userId,
      source_type: "url",
      title: normalized.hostname.replace(/^www\./, ""),
      canonical_url: canonicalUrl,
      content_hash: contentHash,
      why_saved: input.why_saved || null,
      status: "queued",
    })
    .select("id, status, title")
    .single();

  if (insertError?.code === "23505") {
    const { data: existing } = await supabase
      .from("sources")
      .select("id, status, title")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .maybeSingle();
    return NextResponse.json(
      { error: "Already saved.", existing },
      { status: 409 },
    );
  }

  if (insertError || !source) {
    return NextResponse.json(
      { error: insertError?.message || "Could not save that link." },
      { status: 500 },
    );
  }

  // Answer as soon as the row exists, then extract/enrich/embed after the
  // response. A save from a phone share sheet must survive the app being
  // closed a second later — the same contract /api/capture already honours.
  after(async () => {
    try {
      await processSource(source.id, userId);
    } catch {
      // processSource persists a user-visible failure state.
    }
  });

  return NextResponse.json({ source }, { status: 202 });
}
