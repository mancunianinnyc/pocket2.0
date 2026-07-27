import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { embedTexts } from "@/lib/pipeline/embed";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function asVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = z
    .object({
      q: z.string().trim().min(2).max(500),
      project: z.string().uuid().optional(),
    })
    .safeParse({
      q: url.searchParams.get("q"),
      project: url.searchParams.get("project") || undefined,
    });
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a search query." }, { status: 400 });
  }

  const [embedding] = await embedTexts([parsed.data.q]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: parsed.data.q,
    query_embedding: asVector(embedding),
    match_count: 24,
    filter_project_id: parsed.data.project ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
