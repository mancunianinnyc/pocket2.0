import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Quote,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareOriginalButton } from "@/components/share-original";
import { SourceActions } from "@/components/source-actions";
import { SourceStatusBadge } from "@/components/source-status";
import { createClient } from "@/lib/supabase/server";
import {
  firstMetadata,
  type LibrarySource,
} from "@/types/library";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) notFound();

  const { data } = await supabase
    .from("sources")
    .select(
      "id, source_type, title, canonical_url, extracted_text, author, published_at, saved_at, status, processing_error, why_saved, source_metadata(summary, key_claims, topics, entities, content_type, reading_time_minutes, warnings, model_name)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) notFound();

  const source = data as LibrarySource;
  const metadata = firstMetadata(source);
  const paragraphs =
    source.extracted_text?.split(/\n{2,}/).filter(Boolean) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">
      <Link
        href="/library"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink/70 hover:text-moss"
      >
        <ArrowLeft size={17} />
        Library
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="min-w-0 rounded-[1.8rem] border border-ink/8 bg-white/78 px-5 py-7 shadow-[0_24px_70px_rgba(50,65,56,0.07)] sm:px-9 sm:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <SourceStatusBadge status={source.status} />
            {metadata?.content_type ? (
              <span className="text-xs font-medium text-ink/62">
                {metadata.content_type}
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-5xl">
            {source.title || "Untitled source"}
          </h1>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/62">
            {source.author ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={15} />
                {source.author}
              </span>
            ) : null}
            {source.published_at ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={15} />
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(source.published_at),
                )}
              </span>
            ) : null}
            {metadata?.reading_time_minutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={15} />
                {metadata.reading_time_minutes} min read
              </span>
            ) : null}
          </div>

          {source.canonical_url ? (
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <a
                href={source.canonical_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-4 text-[13px] font-semibold text-ink/70 hover:border-moss/30 hover:text-moss"
              >
                See original
                <ArrowUpRight size={15} />
              </a>
              <ShareOriginalButton
                url={source.canonical_url}
                title={source.title || "Saved link"}
              />
            </div>
          ) : null}

          {/* Mobile keeps the summary within thumb's reach — the aside lands
              below the whole article on small screens. Desktop uses the aside. */}
          {metadata?.summary ? (
            <details className="group mt-7 overflow-hidden rounded-2xl border border-moss/15 bg-sage/45 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss [&::-webkit-details-marker]:hidden">
                In brief
                <ChevronDown
                  size={17}
                  aria-hidden
                  className="details-chevron shrink-0"
                />
              </summary>
              <p className="px-4 pb-4 text-sm leading-6 text-ink/80">
                {metadata.summary}
              </p>
            </details>
          ) : null}

          {source.status === "failed" ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">Processing failed</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                {source.processing_error || "We could not read this source."}
              </p>
            </div>
          ) : null}

          {paragraphs.length ? (
            <div className="mt-9 space-y-5 text-[17px] leading-8 text-ink/78">
              {paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          ) : source.status !== "failed" ? (
            <p className="mt-9 text-ink/70">
              This item is still being prepared. Refresh in a moment.
            </p>
          ) : null}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {metadata?.summary ? (
            <section className="hidden rounded-2xl border border-moss/12 bg-sage/55 p-5 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">
                In brief
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/80">
                {metadata.summary}
              </p>
            </section>
          ) : null}

          {metadata?.key_claims?.length ? (
            <section className="rounded-2xl border border-ink/8 bg-white/62 p-5">
              <div className="flex items-center gap-2">
                <Quote className="text-clay" size={17} />
                <h2 className="text-sm font-semibold">Key claims</h2>
              </div>
              <ul className="mt-4 space-y-3">
                {metadata.key_claims.map((claim) => (
                  <li
                    key={claim}
                    className="border-l-2 border-cream pl-3 text-sm leading-6 text-ink/75"
                  >
                    {claim}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {metadata?.topics?.length ? (
            <section className="rounded-2xl border border-ink/8 bg-white/62 p-5">
              <h2 className="text-sm font-semibold">Topics</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {metadata.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-cream px-2.5 py-1 text-xs text-ink/75"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <SourceActions
            sourceId={source.id}
            canRetry={source.status === "failed"}
          />
        </aside>
      </div>
    </main>
  );
}
