import { Waypoints } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { domain, gradientFor } from "./source-card";
import { SiteIcon } from "./site-icon";

type RelatedSource = {
  source_id: string;
  title: string | null;
  canonical_url: string | null;
  author: string | null;
  favicon_url: string | null;
  thumbnail_url: string | null;
  similarity: number;
  passage: string | null;
};

/**
 * Chunks start wherever the chunker cut, often mid-sentence — trim to a short
 * excerpt and mark the cuts so it reads as a quote, not a broken line.
 */
function excerpt(text: string | null) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  const lead = /^[a-z,;]/.test(flat) ? "…" : "";
  if (flat.length <= 170) return `${lead}${flat}`;
  const cut = flat.slice(0, 170);
  return `${lead}${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/**
 * "Connects to": the other saves closest in meaning to this one, each with the
 * passage that makes the link. Renders nothing when no match clears the
 * similarity floor — an empty panel beats a weak connection.
 */
export async function RelatedSources({ sourceId }: { sourceId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("related_sources", {
    target_source_id: sourceId,
    match_count: 5,
  });

  if (error) {
    console.error("related_sources failed", error.message);
    return null;
  }

  const related = (data ?? []) as RelatedSource[];
  if (!related.length) return null;

  return (
    <section className="rounded-2xl border border-ink/8 bg-white/62 p-5">
      <div className="flex items-center gap-2">
        <Waypoints className="text-moss" size={17} />
        <h2 className="text-sm font-semibold">Connects to</h2>
      </div>
      <ul className="mt-4 space-y-1">
        {related.map((item) => {
          const itemDomain = domain(item.canonical_url);
          const gradient = gradientFor(itemDomain);
          const quote = excerpt(item.passage);
          return (
            <li key={item.source_id}>
              <Link
                href={`/library/${item.source_id}`}
                className="group -mx-2 flex min-h-11 gap-3 rounded-xl px-2 py-2.5 hover:bg-cream/60"
              >
                {item.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: gradient.bg, color: gradient.fg }}
                  >
                    <SiteIcon
                      src={item.favicon_url}
                      domain={itemDomain}
                      mark={itemDomain.split(".")[0].slice(0, 2)}
                      color={gradient.fg}
                      size={20}
                    />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-ink/62">
                    {[itemDomain, item.author].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.01em] text-ink group-hover:text-moss">
                    {item.title || "Untitled source"}
                  </span>
                  {quote ? (
                    <span className="mt-1.5 line-clamp-3 border-l-2 border-cream pl-2.5 text-xs leading-5 text-ink/70">
                      {quote}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
