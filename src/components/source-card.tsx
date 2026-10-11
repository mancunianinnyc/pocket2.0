import Link from "next/link";
import {
  firstMetadata,
  type LibrarySource,
} from "@/types/library";
import { SiteIcon } from "./site-icon";
import { StarButton } from "./star-button";

export function domain(url: string | null) {
  if (!url) return "Note";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
}

function isTweet(url: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com" || host === "twitter.com";
  } catch {
    return false;
  }
}

/** First sentence of an enrichment summary — a one-liner that actually finishes. */
function gist(text: string | null | undefined) {
  if (!text) return null;
  return text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text;
}

/** Monogram colour for sites whose favicon can't be reached. */
export const MONOGRAM_COLOR = "#14573f";

export function monogram(sourceDomain: string) {
  return sourceDomain.split(".")[0].slice(0, 2);
}

function savedDate(source: LibrarySource) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(source.saved_at));
}

/** "site.com · Author · 8 min" — the row's quiet top line. */
function metaLine(source: LibrarySource, lead: string) {
  const minutes = firstMetadata(source)?.reading_time_minutes;
  return [lead, source.author, minutes ? `${minutes} min` : savedDate(source)]
    .filter(Boolean)
    .join(" · ");
}

/** Tweet imports store "@handle: first line…" titles and "Tweet by Name (@handle), date:\n\ntext" bodies. */
function tweetParts(source: LibrarySource) {
  const handle = source.title?.match(/^@[A-Za-z0-9_]+/)?.[0] ?? "@x";
  const body = source.extracted_text ?? "";
  const separator = body.indexOf("\n\n");
  const text =
    separator > -1 && /^Tweet by /.test(body)
      ? body.slice(separator + 2)
      : body || source.title || "";
  return { handle, text };
}

/** Processing and failure read as words in the meta line, not as badges. */
function StatusNote({ source }: { source: LibrarySource }) {
  if (source.status === "failed") {
    return <span className="text-red-700"> · couldn’t read this</span>;
  }
  if (source.status === "queued" || source.status === "processing") {
    return <span className="text-moss"> · reading…</span>;
  }
  return null;
}

/**
 * A library row in the editorial style: meta line, serif title, one-line
 * gist, and the poster image on the right when the source has one. Rows are
 * separated by hairlines rather than boxed as cards.
 */
export function SourceRow({ source }: { source: LibrarySource }) {
  const metadata = firstMetadata(source);
  const sourceDomain = domain(source.canonical_url);
  const tweet = isTweet(source.canonical_url);
  const { handle, text } = tweet ? tweetParts(source) : { handle: "", text: "" };
  const summary =
    source.status === "failed"
      ? source.processing_error
      : metadata?.summary;

  return (
    /* The star sits outside the row link — a button nested in an anchor is
       invalid, and triage shouldn't navigate. */
    <div className="group relative border-b border-rule">
      <Link
        href={`/library/${source.id}`}
        className="flex gap-5 py-5 pr-12 sm:gap-7 sm:py-6"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12.5px] text-ink/62">
            <span className="flex size-4 shrink-0 items-center justify-center">
              {tweet ? (
                <span aria-hidden className="text-[13px] font-bold text-ink/70">
                  𝕏
                </span>
              ) : (
                <SiteIcon
                  src={source.favicon_url}
                  domain={sourceDomain}
                  mark={monogram(sourceDomain)}
                  color={MONOGRAM_COLOR}
                  size={16}
                />
              )}
            </span>
            <span className="truncate">
              {tweet ? `${handle} · ${savedDate(source)}` : metaLine(source, sourceDomain)}
              <StatusNote source={source} />
            </span>
          </p>
          {tweet ? (
            <p className="mt-1.5 line-clamp-4 whitespace-pre-line font-serif text-[19px] leading-[1.4] text-ink group-hover:text-moss sm:text-[21px]">
              {text}
            </p>
          ) : (
            <>
              <h2 className="mt-1.5 line-clamp-3 font-serif text-[21px] font-medium leading-[1.22] tracking-[-0.012em] text-ink group-hover:text-moss sm:text-[25px]">
                {source.title || "Untitled source"}
              </h2>
              {summary ? (
                <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink/70 sm:text-[15px]">
                  {gist(summary)}
                </p>
              ) : null}
            </>
          )}
        </div>
        {source.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.thumbnail_url}
            alt=""
            loading="lazy"
            className="mt-6 h-[68px] w-24 shrink-0 rounded-md object-cover sm:h-[88px] sm:w-32"
          />
        ) : null}
      </Link>
      <span className="absolute right-0 top-3.5 sm:top-4.5">
        <StarButton
          sourceId={source.id}
          starred={Boolean(source.starred_at)}
        />
      </span>
    </div>
  );
}
