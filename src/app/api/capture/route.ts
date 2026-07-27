import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { processSource } from "@/lib/pipeline/process-source";
import { normalizePublicUrl } from "@/lib/pipeline/url-safety";

export const runtime = "nodejs";
export const maxDuration = 300;

const captureSchema = z.object({
  url: z.string().url().max(8_192),
  note: z.string().trim().max(2_000).optional(),
});

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing capture token." }, { status: 401 });
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token.startsWith("pl_") || token.length < 35) {
    return NextResponse.json({ error: "Invalid capture token." }, { status: 401 });
  }

  let input: z.infer<typeof captureSchema>;
  try {
    input = captureSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Provide a valid URL." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: tokenRecord } = await admin
    .from("capture_tokens")
    .select("id, user_id")
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!tokenRecord) {
    return NextResponse.json({ error: "Invalid capture token." }, { status: 401 });
  }

  const { data: withinLimit, error: limitError } = await admin.rpc(
    "consume_rate_limit",
    {
      target_user_id: tokenRecord.user_id,
      target_action: "capture",
      allowed_requests: 30,
      window_seconds: 3_600,
    },
  );
  if (limitError) {
    return NextResponse.json({ error: "Rate-limit check failed." }, { status: 500 });
  }
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Capture limit reached. Try again in an hour." },
      { status: 429 },
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
  const contentHash = hash(canonicalUrl);
  const { data: source, error: insertError } = await admin
    .from("sources")
    .insert({
      user_id: tokenRecord.user_id,
      source_type: "url",
      title: normalized.hostname.replace(/^www\./, ""),
      canonical_url: canonicalUrl,
      content_hash: contentHash,
      why_saved: input.note || null,
      status: "queued",
    })
    .select("id, status")
    .single();

  if (insertError?.code === "23505") {
    const { data: existing } = await admin
      .from("sources")
      .select("id, status")
      .eq("user_id", tokenRecord.user_id)
      .eq("content_hash", contentHash)
      .maybeSingle();
    return NextResponse.json({ accepted: true, existing });
  }
  if (insertError || !source) {
    return NextResponse.json(
      { error: insertError?.message || "Could not save that link." },
      { status: 500 },
    );
  }

  await admin
    .from("capture_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRecord.id)
    .eq("user_id", tokenRecord.user_id);

  after(async () => {
    try {
      await processSource(source.id, tokenRecord.user_id);
    } catch {
      // processSource persists a user-visible failure state.
    }
  });

  return NextResponse.json(
    { accepted: true, source: { id: source.id, status: source.status } },
    { status: 202 },
  );
}
