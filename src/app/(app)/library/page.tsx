import { BookMarked } from "lucide-react";
import { LibraryBrowser } from "@/components/library-browser";
import { SaveSourceForm } from "@/components/save-source-form";
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
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-10 md:pb-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-clay">Save now.</p>
        <h1 className="mt-1 text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
          Understand later.
        </h1>

        <div className="mt-5">
          <SaveSourceForm />
        </div>
      </div>

      <section className="mx-auto mt-7 max-w-3xl">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Could not load your library: {error.message}
          </div>
        ) : sources.length ? (
          <LibraryBrowser sources={sources} />
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-ink/15 bg-white/45 px-6 py-14 text-center">
            <BookMarked className="mx-auto text-moss/55" size={32} strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
              Nothing saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/70">
              Paste the first link above. A readable copy and short summary will
              land here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
