"use client";

import { ArrowUp, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { firstMetadata, type LibrarySource } from "@/types/library";
import { Resurface } from "./resurface";
import { domain, SourceRow } from "./source-card";

type Filter = "all" | "starred" | "media" | "posts" | "working" | "failed";

const MEDIA_HOSTS = ["youtube.com", "youtu.be", "open.spotify.com", "spotify.com"];
const POST_HOSTS = ["x.com", "twitter.com"];

function hostOf(source: LibrarySource) {
  return domain(source.canonical_url).replace(/^m\./, "");
}

function matchesFilter(source: LibrarySource, filter: Filter) {
  switch (filter) {
    case "all":
      return true;
    case "starred":
      return Boolean(source.starred_at);
    case "media":
      return MEDIA_HOSTS.includes(hostOf(source));
    case "posts":
      return POST_HOSTS.includes(hostOf(source));
    case "working":
      return source.status === "queued" || source.status === "processing";
    case "failed":
      return source.status === "failed";
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

/** "October", or "October 2025" once it's not this year. */
function monthLabel(iso: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("en", {
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export function LibraryBrowser({
  sources,
  resurface,
}: {
  sources: LibrarySource[];
  /** Shuffled ids for "From your library", picked on the server. */
  resurface: string[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const indexed = useMemo(
    () => sources.map((source) => ({ source, text: haystack(source) })),
    [sources],
  );

  /* Working and Failed only appear while there is something in them. */
  const tabs = useMemo(() => {
    const options: Array<{ value: Filter; label: string }> = [
      { value: "all", label: "All" },
      { value: "starred", label: "Featured" },
      { value: "media", label: "Video & audio" },
      { value: "posts", label: "Posts" },
    ];
    if (sources.some((s) => matchesFilter(s, "working"))) {
      options.push({ value: "working", label: "Reading now" });
    }
    if (sources.some((s) => matchesFilter(s, "failed"))) {
      options.push({ value: "failed", label: "Couldn’t read" });
    }
    return options;
  }, [sources]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indexed
      .filter(
        (entry) =>
          (!needle || entry.text.includes(needle)) &&
          matchesFilter(entry.source, filter),
      )
      .map((entry) => entry.source);
  }, [indexed, query, filter]);

  /** Results are already newest-first, so months come out in order. */
  const groups = useMemo(() => {
    const byMonth: Array<{ label: string; items: LibrarySource[] }> = [];
    for (const source of results) {
      const label = monthLabel(source.saved_at);
      const last = byMonth.at(-1);
      if (last?.label === label) last.items.push(source);
      else byMonth.push({ label, items: [source] });
    }
    return byMonth;
  }, [results]);

  const filtered = query.trim().length > 0 || filter !== "all";

  function clearAll() {
    setQuery("");
    setFilter("all");
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_15.5rem] lg:gap-20">
      {/* grid-cols-1 is load-bearing: without an explicit minmax(0,1fr)
          track the single column sizes to content and overflows on a phone. */}
      <aside className="lg:col-start-2 lg:row-start-1 lg:pt-16">
        <div className="lg:sticky lg:top-28">
          <Resurface sources={sources} order={resurface} />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="sticky top-16 z-30 -mx-4 bg-paper/95 px-4 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-end gap-x-6 border-b border-rule">
            <div
              role="group"
              aria-label="Show"
              className="-mb-px flex min-w-0 max-w-full gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`h-11 shrink-0 border-b-2 text-sm transition ${
                    filter === option.value
                      ? "border-ink font-semibold text-ink"
                      : "border-transparent text-ink/62 hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="mb-1 flex w-full items-center gap-2 text-ink/62 xl:ml-auto xl:w-56">
              <Search size={16} className="shrink-0" aria-hidden />
              <span className="sr-only">Filter your library</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by title, site, topic…"
                className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink/55 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter text"
                  className="-mr-2 flex size-10 shrink-0 items-center justify-center hover:text-ink"
                >
                  <X size={16} />
                </button>
              ) : null}
            </label>
          </div>
        </div>

        {filtered ? (
          <div className="flex items-center justify-between gap-3 pt-5">
            <p aria-live="polite" className="text-sm text-ink/70">
              {results.length} of {sources.length}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="h-11 text-sm font-medium text-moss hover:text-ink"
            >
              Clear
            </button>
          </div>
        ) : null}

        {groups.length ? (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="pb-1 pt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/62">
                {group.label}
              </h2>
              {group.items.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </section>
          ))
        ) : (
          <div className="py-16 text-center">
            <p className="font-serif text-xl italic text-ink/70">
              Nothing matches that.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-2 h-11 text-sm font-medium text-moss hover:text-ink"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-4 z-30 flex size-11 items-center justify-center rounded-full border border-rule bg-paper text-ink/70 shadow-[0_6px_20px_rgba(14,32,24,0.12)] hover:text-moss md:bottom-8"
        >
          <ArrowUp size={19} />
        </button>
      ) : null}
    </div>
  );
}
