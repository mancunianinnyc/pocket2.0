import { LibraryBrowser } from "@/components/library-browser";
import { SaveSourceForm } from "@/components/save-source-form";
import { resurfaceOrder } from "@/lib/resurface";
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
          "id, source_type, title, canonical_url, extracted_text, author, published_at, saved_at, status, processing_error, why_saved, starred_at, public_blurb, favicon_url, thumbnail_url, source_metadata(summary, key_claims, topics, entities, content_type, reading_time_minutes, warnings, model_name)",
        )
        .eq("user_id", userId)
        .order("saved_at", { ascending: false })
    : { data: [], error: null };

  const sources = (data ?? []) as LibrarySource[];
  const featured = sources.filter((source) => source.starred_at).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <div className="lg:max-w-[calc(100%-20.5rem)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-serif text-[42px] font-medium leading-none tracking-[-0.025em] sm:text-[56px]">
            Library
          </h1>
          {sources.length ? (
            <p className="text-sm text-ink/62">
              {sources.length} saves{featured ? ` · ${featured} featured` : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          <SaveSourceForm />
        </div>
      </div>

      <section className="mt-4">
        {error ? (
          <p className="py-8 text-sm text-red-700">
            Could not load your library: {error.message}
          </p>
        ) : sources.length ? (
          <LibraryBrowser sources={sources} resurface={resurfaceOrder(sources)} />
        ) : (
          <div className="py-20 text-center">
            <h2 className="font-serif text-2xl italic">Nothing saved yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/70">
              Paste the first link above. A readable copy and a short summary
              land here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
