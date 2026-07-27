import { NextResponse } from "next/server";
import { z } from "zod";
import { answerFromEvidence } from "@/lib/ask-library";
import { getAuthenticatedUserId } from "@/lib/auth";
import { embedTexts } from "@/lib/pipeline/embed";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SearchResult } from "@/types/search";

export const runtime = "nodejs";
export const maxDuration = 300;

const askInput = z.object({
  question: z.string().trim().min(3).max(2_000),
  project_id: z.string().uuid().nullable().optional(),
});

function asVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof askInput>;
  try {
    input = askInput.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Ask a complete question." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: withinLimit, error: limitError } = await admin.rpc(
    "consume_rate_limit",
    {
      target_user_id: userId,
      target_action: "ask",
      allowed_requests: 40,
      window_seconds: 3_600,
    },
  );
  if (limitError) {
    return NextResponse.json({ error: "Rate-limit check failed." }, { status: 500 });
  }
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Ask limit reached. Try again in an hour." },
      { status: 429 },
    );
  }

  const [embedding] = await embedTexts([input.question]);
  const supabase = await createClient();
  const { data: matches, error: searchError } = await supabase.rpc(
    "hybrid_search",
    {
      query_text: input.question,
      query_embedding: asVector(embedding),
      match_count: 24,
      filter_project_id: input.project_id ?? null,
    },
  );
  if (searchError) {
    return NextResponse.json({ error: searchError.message }, { status: 500 });
  }

  const evidence = ((matches ?? []) as SearchResult[]).slice(0, 8);
  const answer = await answerFromEvidence(input.question, evidence);

  const { error: saveError } = await supabase.from("saved_queries").insert({
    user_id: userId,
    question: input.question,
    answer: answer.answer,
    citations: answer.citations,
  });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ answer });
}
