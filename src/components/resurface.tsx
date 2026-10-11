"use client";

import { Shuffle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { firstMetadata, type LibrarySource } from "@/types/library";
import { domain } from "./source-card";

/**
 * "From your library": one older save brought back, with a shuffle for
 * another. A dark card above the list on a phone; a quiet rail beside it on
 * desktop. The server supplies the shuffled order (`lib/resurface.ts`).
 */
export function Resurface({
  sources,
  order,
}: {
  sources: LibrarySource[];
  order: string[];
}) {
  const byId = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  // Hold the first order: a router.refresh (e.g. starring a row) reshuffles
  // on the server, and the pick shouldn't jump while you are on the page.
  const [shuffled] = useState(order);
  const [index, setIndex] = useState(0);
  const current = shuffled.length
    ? byId.get(shuffled[index % shuffled.length])
    : null;
  const next = () => setIndex((value) => value + 1);

  if (!current) return null;

  const minutes = firstMetadata(current)?.reading_time_minutes;
  const savedOn = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(current.saved_at));

  return (
    <section
      aria-label="From your library"
      className="rounded-xl bg-ink p-4 text-paper lg:rounded-none lg:bg-transparent lg:p-0 lg:text-ink"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime lg:text-ink/62">
          From your library
        </h2>
        <button
          type="button"
          onClick={next}
          aria-label="Show another"
          className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-lime lg:hidden"
        >
          <Shuffle size={17} />
        </button>
      </div>
      <p className="mt-1 font-serif text-[15px] italic text-paper/75 lg:mt-3 lg:text-ink/70">
        Saved {savedOn}
      </p>
      <Link
        href={`/library/${current.id}`}
        className="mt-1.5 block font-serif text-[21px] font-medium leading-[1.25] hover:text-lime lg:text-[22px] lg:hover:text-moss"
      >
        {current.title || "Untitled source"}
      </Link>
      <p className="mt-2 text-[12.5px] text-paper/75 lg:text-ink/62">
        {[domain(current.canonical_url), current.author, minutes ? `${minutes} min` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <button
        type="button"
        onClick={next}
        className="mt-5 hidden h-10 items-center gap-2 rounded-full border border-ink/20 px-4 text-sm font-medium hover:border-moss hover:text-moss lg:inline-flex"
      >
        <Shuffle size={15} />
        Shuffle
      </button>
    </section>
  );
}
