import { ArrowUpRight, FileText } from "lucide-react";
import Link from "next/link";
import {
  firstMetadata,
  type LibrarySource,
} from "@/types/library";
import { SourceStatusBadge } from "./source-status";

function domain(url: string | null) {
  if (!url) return "Note";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
}

export function SourceCard({ source }: { source: LibrarySource }) {
  const metadata = firstMetadata(source);
  const topics = metadata?.topics?.slice(0, 3) ?? [];

  return (
    <Link
      href={`/library/${source.id}`}
      className="group block rounded-[1.35rem] border border-ink/8 bg-white/72 p-5 transition hover:-translate-y-0.5 hover:border-moss/25 hover:bg-white hover:shadow-[0_16px_45px_rgba(52,68,58,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink/48">
          <FileText size={14} />
          <span className="truncate">{domain(source.canonical_url)}</span>
          <span aria-hidden>·</span>
          <time dateTime={source.saved_at}>
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
            }).format(new Date(source.saved_at))}
          </time>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>

      <div className="mt-4 flex gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug tracking-[-0.025em] text-ink group-hover:text-moss-dark">
            {source.title || "Untitled source"}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/58">
            {metadata?.summary ||
              (source.status === "failed"
                ? source.processing_error
                : "We’re extracting the useful part now.")}
          </p>
        </div>
        <ArrowUpRight
          className="mt-0.5 shrink-0 text-ink/25 transition group-hover:text-moss"
          size={19}
        />
      </div>

      {topics.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-ink/58"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
