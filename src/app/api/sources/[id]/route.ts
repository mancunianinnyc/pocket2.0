import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    why_saved: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .select(
      "*, source_metadata(*), highlights(*), notes(*), source_projects(project_id)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ source: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let input: z.infer<typeof updateSchema>;
  try {
    input = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .update(input)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, title, why_saved, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ source: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("sources")
    .select("id, original_file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (source.original_file_path) {
    const admin = getAdminClient();
    const { error: storageError } = await admin.storage
      .from("sources")
      .remove([source.original_file_path]);
    if (storageError) {
      return NextResponse.json(
        { error: "Could not remove the stored file." },
        { status: 500 },
      );
    }
  }

  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
