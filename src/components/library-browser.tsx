"use client";

import { ArrowUp, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { firstMetadata, type LibrarySource } from "@/types/library";
import { SourceCard } from "./source-card";

type StatusFilter = "all" | "starred" | "ready" | "processing" | "failed";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "starred", label: "★ Featured" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Working" },
  { value: "failed", label: "Failed" },
];

function domain(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Everything a source can be matched on, lowercased once per source. */
function haystack(source: LibrarySource) {
  const metadata = firstMetadata(source);
  return [
    source.title,
    source.author,
    source.why_saved,
    metadata?.summary,
    metadata?.content_type,
    domain(source.canonical_url),
    ...(metadata?.topics ?? []),
    ...(metadata?.entities ?? []).map((entity) => entity.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function LibraryBrowser({ sources }: { sources: LibrarySource[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const indexed = useMemo(
    () =>
      sources.map((source) => ({
        source,
        text: haystack(source),
        topics: firstMetadata(source)?.topics ?? [],
      })),
    [sources],
  );

  /** Topics worth a chip: shared by more than one source, most common first. */
  const topTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of indexed) {
      for (const value of entry.topics) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value]) => value);
  }, [indexed]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indexed
      .filter((entry) => {
        if (needle && !entry.text.includes(needle)) return false;
        if (topic && !entry.topics.includes(topic)) return false;
        if (status === "all") return true;
        if (status === "starred") return Boolean(entry.source.starred_at);
        if (status === "processing") {
          return (
            entry.source.status === "processing" ||
            entry.source.status === "queued"
          );
        }
        return entry.source.status === status;
      })
      .map((entry) => entry.source);
  }, [indexed, query, status, topic]);

  const filtered =
    query.trim().length > 0 || topic !== null || status !== "all";

  function clearAll() {
    setQuery("");
    setStatus("all");
    setTopic(null);
  }

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 mb-5 border-b border-ink/8 bg-paper/92 px-4 pb-2.5 pt-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-ink/14 bg-white px-3 shadow-sm transition focus-within:border-moss focus-within:shadow-[0_0_0_3px_rgba(217,244,92,0.6)]">
          <Search className="shrink-0 text-moss" size={18} aria-hidden />
          <label className="sr-only" htmlFor="library-filter">
            Filter your library
          </label>
          <input
            id="library-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title, topic, or site…"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink/55 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear filter text"
              className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink/62 hover:text-ink"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Filter by status and topic"
          className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition ${
                status === option.value
                  ? "bg-ink text-lime"
                  : "bg-white/70 text-ink/70 hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}

          {topTopics.length ? (
            <span
              aria-hidden
              className="mx-1 h-11 w-px shrink-0 self-center bg-ink/12"
            />
          ) : null}

          {topTopics.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTopic(topic === value ? null : value)}
              aria-pressed={topic === value}
              className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-medium transition ${
                topic === value
                  ? "bg-moss text-white"
                  : "bg-cream text-ink/75 hover:text-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/62">
            {filtered ? "Matching" : "Recently saved"}
          </p>
          <p aria-live="polite" className="mt-1 text-sm text-ink/70">
            {results.length} {results.length === 1 ? "item" : "items"}
            {filtered ? ` of ${sources.length}` : ""}
          </p>
        </div>
        {filtered ? (
          <button
            type="button"
            onClick={clearAll}
            className="h-11 rounded-lg px-3 text-[13px] font-semibold text-moss hover:bg-cream"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {results.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
          {/* grid-cols-1 is load-bearing: without an explicit minmax(0,1fr)
              track the single column sizes to content, and cards overflow the
              container on a phone. */}
          {results.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.6rem] border border-dashed border-ink/15 bg-white/45 px-6 py-12 text-center">
          <p className="text-sm text-ink/70">Nothing matches those filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-3 h-11 rounded-lg px-3 text-[13px] font-semibold text-moss hover:bg-cream"
          >
            Clear filters
          </button>
        </div>
      )}

      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-4 z-30 flex size-11 items-center justify-center rounded-full border border-ink/10 bg-white text-ink/70 shadow-[0_10px_30px_rgba(14,32,24,0.16)] hover:text-moss md:bottom-8"
        >
          <ArrowUp size={19} />
        </button>
      ) : null}
    </div>
  );
}
