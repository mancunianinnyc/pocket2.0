import { BookMarked } from "lucide-react";
import { SaveSourceForm } from "@/components/save-source-form";
import { SourceCard } from "@/components/source-card";
import { createClient } from "@/lib/supabase/server";
import type { LibrarySource } from "@/types/library";

export const metadata = {
  title: "Library",
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  const { data, error } = userId
    ? await supabase
        .from("sources")
        .select(
          "id, source_type, title, canonical_url, extracted_text, author, published_at, saved_at, status, processing_error, why_saved, source_metadata(summary, key_claims, topics, entities, content_type, reading_time_minutes, warnings, model_name)",
        )
        .eq("user_id", userId)
        .order("saved_at", { ascending: false })
    : { data: [], error: null };

  const sources = (data ?? []) as LibrarySource[];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-clay">Your quiet corner</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl">
          Save now. Understand later.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-ink/58">
          Drop in a link. Your library keeps the readable version, the useful
          ideas, and a trail back to the original.
        </p>

        <div className="mt-7">
          <SaveSourceForm />
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-3xl">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/38">
              Recently saved
            </p>
            <p className="mt-1 text-sm text-ink/50">
              {sources.length} {sources.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Could not load your library: {error.message}
          </div>
        ) : sources.length ? (
          <div className="grid gap-3">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-ink/15 bg-white/45 px-6 py-14 text-center">
            <BookMarked className="mx-auto text-moss/55" size={32} strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
              Nothing saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/50">
              Paste the first link above. A readable copy and short summary will
              land here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
