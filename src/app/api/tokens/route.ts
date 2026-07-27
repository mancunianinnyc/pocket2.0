import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_tokens")
    .select("id, label, last_used_at, created_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tokens: data });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label: string;
  try {
    label = z
      .object({ label: z.string().trim().min(1).max(80) })
      .parse(await request.json()).label;
  } catch {
    return NextResponse.json({ error: "Add a short label." }, { status: 400 });
  }

  const token = `pl_${randomBytes(32).toString("base64url")}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_tokens")
    .insert({ user_id: userId, label, token_hash: hash(token) })
    .select("id, label, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token, record: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing token id." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Token not found." }, { status: 404 });
  }

  return NextResponse.json({ revoked: true });
}
