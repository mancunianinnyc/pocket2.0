import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { processSource } from "@/lib/pipeline/process-source";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const source = await processSource(id, userId);
    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Processing failed.",
      },
      { status: 422 },
    );
  }
}
