import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { BLURB_MAX_CHARS, generateBlurb } from "@/lib/pipeline/blurb";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { firstMetadata, type LibrarySource } from "@/types/library";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    why_saved: z.string().trim().max(2_000).nullable().optional(),
    starred: z.boolean().optional(),
    public_blurb: z.string().trim().max(BLURB_MAX_CHARS).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

/**
 * Starring publishes the source, so it needs a line to publish. Written from
 * the stored summary after the response returns — the star itself is instant.
 */
async function backfillBlurb(sourceId: string, userId: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("sources")
    .select(
      "id, title, author, public_blurb, starred_at, source_metadata(summary, content_type)",
    )
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !data.starred_at || data.public_blurb) return;

  const metadata = firstMetadata(data as unknown as LibrarySource);
  if (!metadata?.summary) return;

  const blurb = await generateBlurb({
    title: data.title || "Untitled",
    summary: metadata.summary,
    author: data.author,
    contentType: metadata.content_type,
  });

  await admin
    .from("sources")
    .update({ public_blurb: blurb })
    .eq("id", sourceId)
    .eq("user_id", userId)
    .is("public_blurb", null);
}

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

  const { starred, ...fields } = input;
  const patch: Record<string, unknown> = { ...fields };
  if (starred !== undefined) {
    patch.starred_at = starred ? new Date().toISOString() : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, title, why_saved, starred_at, public_blurb, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (starred && !data.public_blurb) {
    after(async () => {
      try {
        await backfillBlurb(id, userId);
      } catch {
        // The star still stands; the public page falls back to the summary.
      }
    });
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
