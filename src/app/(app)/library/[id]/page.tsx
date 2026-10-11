import { ArrowLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProcessingWatcher } from "@/components/processing-watcher";
import { RelatedSources } from "@/components/related-sources";
import { ShareOriginalButton } from "@/components/share-original";
import { domain } from "@/components/source-card";
import { SourceActions } from "@/components/source-actions";
import { StarButton } from "@/components/star-button";
import { createClient } from "@/lib/supabase/server";
import {
  firstMetadata,
  type LibrarySource,
} from "@/types/library";

/**
 * The brief should orient, not re-tell the piece — older saves carry summaries
 * up to 1,200 characters, which overwhelms the article they introduce.
 */
function brief(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g);
  const cut = sentences ? sentences.slice(0, 2).join("").trim() : text;
  return cut.length > 240 ? `${cut.slice(0, 240).trimEnd()}…` : cut;
}

const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/62";

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
      "id, source_type, title, canonical_url, extracted_text, author, published_at, saved_at, status, processing_error, why_saved, starred_at, public_blurb, favicon_url, thumbnail_url, source_metadata(summary, key_claims, topics, entities, content_type, reading_time_minutes, warnings, model_name)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) notFound();

  const source = data as LibrarySource;
  const metadata = firstMetadata(source);
  const paragraphs =
    source.extracted_text?.split(/\n{2,}/).filter(Boolean) ?? [];
  const reading = source.status === "queued" || source.status === "processing";

  const byline = [
    source.author,
    source.published_at
      ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
          new Date(source.published_at),
        )
      : null,
    metadata?.reading_time_minutes
      ? `${metadata.reading_time_minutes} min read`
      : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-20">
      <ProcessingWatcher status={source.status} />
      <Link
        href="/library"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium text-ink/62 hover:text-ink"
      >
        <ArrowLeft size={16} />
        Library
      </Link>

      {/* One reading column plus a margin, centred as a pair. Nothing is
          boxed: paper, type, and hairlines. */}
      <div className="mt-6 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,40rem)_16.25rem] lg:justify-center lg:gap-20">
        <article className="min-w-0">
          <p className="text-[13px] text-ink/62">
            {[domain(source.canonical_url), metadata?.content_type]
              .filter(Boolean)
              .join(" · ")}
            {reading ? <span className="text-moss"> · reading…</span> : null}
          </p>

          <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[60px] sm:leading-[1.02]">
            {source.title || "Untitled source"}
          </h1>

          {byline.length ? (
            <p className="mt-4 text-sm text-ink/62">{byline.join(" · ")}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-6">
            {source.canonical_url ? (
              <>
                <a
                  href={source.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-moss hover:text-ink"
                >
                  See original
                  <ArrowUpRight size={15} />
                </a>
                <ShareOriginalButton
                  url={source.canonical_url}
                  title={source.title || "Saved link"}
                />
              </>
            ) : null}
            <StarButton
              sourceId={source.id}
              starred={Boolean(source.starred_at)}
              variant="reader"
            />
          </div>

          {source.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.thumbnail_url}
              alt=""
              loading="lazy"
              className="mt-8 w-full rounded-lg object-cover"
            />
          ) : null}

          {metadata?.summary ? (
            <div className="mt-8 border-l-[3px] border-lime py-0.5 pl-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
                In brief
              </p>
              <p className="mt-2 font-serif text-[19px] italic leading-[1.5] text-ink/85 sm:text-[20px]">
                {brief(metadata.summary)}
              </p>
            </div>
          ) : null}

          {source.status === "failed" ? (
            <div className="mt-8 border-l-[3px] border-red-700 py-0.5 pl-5">
              <p className="text-sm font-semibold text-red-700">
                Couldn’t read this
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/70">
                {source.processing_error || "We could not read this source."}
              </p>
            </div>
          ) : null}

          {paragraphs.length ? (
            <div className="mt-9 space-y-[1.1em] font-serif text-[19px] leading-[1.7] text-ink/90 sm:text-[20px]">
              {paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          ) : source.status !== "failed" ? (
            <div className="mt-9 flex items-center gap-3 text-ink/70">
              <LoaderCircle className="shrink-0 animate-spin text-moss" size={18} />
              <p className="font-serif text-lg italic">
                Reading this now — the text and summary land here on their own.
                You can close the app; it keeps going.
              </p>
            </div>
          ) : null}
        </article>

        {/* Not sticky: with connections, claims and topics the margin is
            taller than the viewport, and a pinned aside hides its own bottom. */}
        <aside className="space-y-10 lg:self-start lg:pt-24">
          <div aria-hidden className="flex items-center gap-3 lg:hidden">
            <span className="h-px flex-1 bg-ink/15" />
            <span className="size-[7px] rounded-[2px] bg-lime shadow-[inset_0_0_0_1.2px_#0e2018]" />
            <span className="h-px flex-1 bg-ink/15" />
          </div>

          {source.status === "ready" ? (
            <Suspense fallback={null}>
              <RelatedSources sourceId={source.id} />
            </Suspense>
          ) : null}

          {metadata?.key_claims?.length ? (
            <section>
              <h2 className={LABEL}>Key claims</h2>
              <ul className="mt-3">
                {metadata.key_claims.map((claim) => (
                  <li
                    key={claim}
                    className="border-b border-rule py-3 font-serif text-[16px] leading-[1.5] text-ink/85"
                  >
                    {claim}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {metadata?.topics?.length ? (
            <section>
              <h2 className={LABEL}>Topics</h2>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                {metadata.topics.join(" · ")}
              </p>
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
