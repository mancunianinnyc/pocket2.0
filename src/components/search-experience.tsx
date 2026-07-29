"use client";

import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SearchResult } from "@/types/search";

export function SearchExperience() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const result = (await response.json()) as {
      results?: SearchResult[];
      error?: string;
    };
    setLoading(false);
    setSearched(true);
    if (!response.ok) {
      setError(result.error || "Search failed.");
      return;
    }
    setResults(result.results ?? []);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex rounded-2xl border-[1.5px] border-ink/14 bg-white p-2 shadow-sm transition focus-within:border-moss focus-within:shadow-[0_0_0_3px_rgba(217,244,92,0.6)]">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <Search className="shrink-0 text-moss" size={19} />
          <span className="sr-only">Search your library</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
            minLength={2}
            placeholder="An exact phrase or half-remembered idea…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink/35"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-ink text-lime transition hover:bg-moss disabled:opacity-60 sm:w-auto sm:px-5"
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <span className="hidden font-semibold sm:block">Search</span>}
          <Search className="sm:hidden" size={18} />
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-7 grid gap-3">
        {results.map((result) => (
          <Link
            key={`${result.source_id}-${result.chunk_index}`}
            href={`/library/${result.source_id}`}
            className="group rounded-2xl border border-ink/8 bg-white/70 p-5 hover:border-moss/25 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">{result.title || "Untitled source"}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/58">{result.chunk_text}</p>
              </div>
              <ArrowUpRight className="shrink-0 text-ink/25 group-hover:text-moss" size={18} />
            </div>
          </Link>
        ))}
        {searched && !loading && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/48">
            No matching passages yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
