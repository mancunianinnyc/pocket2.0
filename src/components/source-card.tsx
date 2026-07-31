import Link from "next/link";
import {
  firstMetadata,
  type LibrarySource,
} from "@/types/library";
import { SiteIcon } from "./site-icon";
import { SourceStatusBadge } from "./source-status";
import { StarButton } from "./star-button";

function domain(url: string | null) {
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

const GRADIENTS = [
  { bg: "linear-gradient(135deg,#14573f,#0e2018)", fg: "#d9f45c" },
  { bg: "linear-gradient(160deg,#f0b03f,#e8542f)", fg: "#ffffff" },
  { bg: "linear-gradient(135deg,#d9f45c,#14573f)", fg: "#0e2018" },
  { bg: "linear-gradient(135deg,#0e2018,#2a6b50)", fg: "#d9f45c" },
];

function gradientFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return GRADIENTS[hash % GRADIENTS.length];
}

function savedDate(source: LibrarySource) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(source.saved_at));
}

/** "site.com · Jul 12 · 8 min" — the card's quiet top line. */
function metaLine(source: LibrarySource, lead: string) {
  const minutes = firstMetadata(source)?.reading_time_minutes;
  return [lead, savedDate(source), minutes ? `${minutes} min` : null]
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
  return { handle, name: source.author || handle, text };
}

function TweetCard({ source }: { source: LibrarySource }) {
  const metadata = firstMetadata(source);
  const topics = metadata?.topics?.slice(0, 2) ?? [];
  const { handle, name, text } = tweetParts(source);
  const gradient = gradientFor(handle);

  return (
    <Link
      href={`/library/${source.id}`}
      className="group block rounded-[20px] border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:border-moss/40 hover:shadow-[0_20px_50px_rgba(14,32,24,0.14)]"
    >
      {/* Mobile: compact row */}
      <div className="flex items-center gap-3 p-3 pr-11 sm:hidden">
        <span
          className="flex size-[74px] shrink-0 items-center justify-center rounded-xl text-xl font-bold"
          style={{ background: gradient.bg, color: gradient.fg }}
        >
          𝕏
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/62">
            <span className="size-1.5 shrink-0 rounded-full bg-moss" />
            <span className="truncate">{metaLine(source, handle)}</span>
          </span>
          <span className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-ink">
            {text}
          </span>
          <span className="mt-1 line-clamp-2 text-xs leading-5 text-ink/70">
            {gist(metadata?.summary) || name}
          </span>
        </span>
      </div>

      {/* Desktop: tweet card */}
      <div className="hidden h-full flex-col gap-3 p-4 sm:flex">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: gradient.bg, color: gradient.fg }}
          >
            {(name || handle).replace("@", "").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-[-0.01em]">
              {name}
            </span>
            <span className="block truncate text-[11.5px] text-ink/62">
              {metaLine(source, handle)}
            </span>
          </span>
          <span className="text-sm font-bold text-ink/30">𝕏</span>
        </div>
        <p className="line-clamp-5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/85">
          {text}
        </p>
        {topics.length ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-cream px-2.5 py-1 text-[10.5px] font-semibold text-ink/75"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function ArticleCard({ source }: { source: LibrarySource }) {
  const metadata = firstMetadata(source);
  const topics = metadata?.topics?.slice(0, 2) ?? [];
  const sourceDomain = domain(source.canonical_url);
  const gradient = gradientFor(sourceDomain);
  const mark = sourceDomain.split(".")[0].slice(0, 2);
  const summary =
    metadata?.summary ||
    (source.status === "failed"
      ? source.processing_error
      : "We’re extracting the useful part now.");

  return (
    <Link
      href={`/library/${source.id}`}
      className="group block overflow-hidden rounded-[20px] border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:border-moss/40 hover:shadow-[0_20px_50px_rgba(14,32,24,0.14)]"
    >
      {/* Mobile: compact row */}
      <div className="flex items-center gap-3 p-3 pr-11 sm:hidden">
        <span
          className="flex size-[74px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: gradient.bg, color: gradient.fg }}
        >
          <SiteIcon
            src={source.favicon_url}
            domain={sourceDomain}
            mark={mark}
            color={gradient.fg}
            size={34}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/62">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                source.status === "ready"
                  ? "bg-moss"
                  : source.status === "failed"
                    ? "bg-clay"
                    : "bg-amber-brand"
              }`}
            />
            <span className="truncate">{metaLine(source, sourceDomain)}</span>
          </span>
          <span className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-ink group-hover:text-moss">
            {source.title || "Untitled source"}
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink/70">
            {gist(summary)}
          </span>
        </span>
      </div>

      {/* Desktop: preview card with thumb */}
      <div className="hidden h-full flex-col sm:flex">
        <div
          className="relative flex aspect-[16/9] items-end p-3.5"
          style={{ background: gradient.bg, color: gradient.fg }}
        >
          <SiteIcon
            src={source.favicon_url}
            domain={sourceDomain}
            mark={mark}
            color={gradient.fg}
            size={44}
          />
          <span className="absolute right-3 top-3">
            <SourceStatusBadge status={source.status} />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
          <p className="text-[11.5px] font-semibold text-ink/62">
            {metaLine(source, sourceDomain)}
          </p>
          <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-ink group-hover:text-moss">
            {source.title || "Untitled source"}
          </h2>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink/70">
            {gist(summary)}
          </p>
          {topics.length ? (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-cream px-2.5 py-1 text-[10.5px] font-semibold text-ink/75"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function SourceCard({ source }: { source: LibrarySource }) {
  return (
    /* The star sits outside the card link — a button nested in an anchor is
       invalid, and triage shouldn't navigate. */
    <div className="group relative">
      {isTweet(source.canonical_url) ? (
        <TweetCard source={source} />
      ) : (
        <ArticleCard source={source} />
      )}
      {/* Right-centred on mobile rows; on desktop it moves to the thumbnail's
          top-left so it never collides with the status badge. */}
      <span className="absolute right-1 top-1/2 -translate-y-1/2 sm:right-auto sm:left-1 sm:top-1 sm:translate-y-0">
        <StarButton
          sourceId={source.id}
          starred={Boolean(source.starred_at)}
        />
      </span>
    </div>
  );
}
