"use client";

import { LoaderCircle, Search } from "lucide-react";
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
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-b-[1.5px] border-ink/25 transition focus-within:border-moss"
      >
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <Search className="shrink-0 text-ink/62" size={18} />
          <span className="sr-only">Search your library</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
            minLength={2}
            placeholder="An exact phrase or half-remembered idea…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink/55"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          aria-label="Search"
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-lime transition hover:bg-moss disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {results.length ? (
        <ol className="mt-6">
          {results.map((result) => (
            <li
              key={`${result.source_id}-${result.chunk_index}`}
              className="border-b border-rule"
            >
              <Link
                href={`/library/${result.source_id}`}
                className="group block py-5"
              >
                <span className="block font-serif text-[21px] font-medium leading-[1.25] tracking-[-0.01em] text-ink group-hover:text-moss">
                  {result.title || "Untitled source"}
                </span>
                <span className="mt-2 line-clamp-3 block font-serif text-[16px] italic leading-[1.55] text-ink/70">
                  {result.chunk_text}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {searched && !loading && results.length === 0 ? (
        <p className="py-14 text-center font-serif text-xl italic text-ink/70">
          No matching passages yet.
        </p>
      ) : null}
    </div>
  );
}
