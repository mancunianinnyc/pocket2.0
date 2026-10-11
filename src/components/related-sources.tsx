import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { domain, MONOGRAM_COLOR, monogram } from "./source-card";
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
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/62">
        Connects to
      </h2>
      <ul className="mt-1">
        {related.map((item) => {
          const itemDomain = domain(item.canonical_url);
          const quote = excerpt(item.passage);
          return (
            <li key={item.source_id} className="border-b border-rule">
              <Link
                href={`/library/${item.source_id}`}
                className="group block py-4"
              >
                <span className="flex items-center gap-2 text-xs text-ink/62">
                  <SiteIcon
                    src={item.favicon_url}
                    domain={itemDomain}
                    mark={monogram(itemDomain)}
                    color={MONOGRAM_COLOR}
                    size={14}
                  />
                  <span className="truncate">
                    {[itemDomain, item.author].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="mt-1.5 block font-serif text-[19px] font-medium leading-[1.25] text-ink group-hover:text-moss">
                  {item.title || "Untitled source"}
                </span>
                {quote ? (
                  <span className="mt-2 line-clamp-3 block font-serif text-[15px] italic leading-[1.5] text-ink/70">
                    {quote}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
