"use client";

import { LoaderCircle, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Gold rather than a brand colour — "starred" has to read at a glance. */
const GOLD = "#f2b32c";

/**
 * Starring publishes a source to the public reading page, so the control says
 * so on the reader. On cards it is icon-only for fast triage down a long list.
 */
export function StarButton({
  sourceId,
  starred,
  variant = "card",
}: {
  sourceId: string;
  starred: boolean;
  variant?: "card" | "reader";
}) {
  const router = useRouter();
  const [on, setOn] = useState(starred);
  const [busy, setBusy] = useState(false);

  async function toggle(event: React.MouseEvent) {
    // Cards sit inside a link to the reader; starring must not navigate.
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ starred: next }),
      });
      if (!response.ok) throw new Error("Could not update the star.");
      router.refresh();
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  const label = on ? "Remove from What I'm Reading" : "Add to What I'm Reading";

  if (variant === "reader") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className={`inline-flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold transition ${
          on
            ? "border-[#f2b32c]/45 bg-[#fdf3dc] text-ink"
            : "border-ink/10 bg-white/70 text-ink/70 hover:border-moss/30 hover:text-moss"
        }`}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={15} />
        ) : (
          <Star
            size={15}
            fill={on ? GOLD : "none"}
            color={on ? GOLD : "currentColor"}
          />
        )}
        {on ? "Featured" : "Feature this"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className="flex size-11 items-center justify-center rounded-full"
    >
      {/* A white chip carries the star so it stays legible on both the white
          card rows and the dark gradient thumbnails. */}
      <span
        className={`flex size-8 items-center justify-center rounded-full transition ${
          on
            ? "bg-white shadow-[0_2px_8px_rgba(14,32,24,0.28)]"
            : "bg-white/75 text-ink/45 shadow-[0_1px_4px_rgba(14,32,24,0.18)] hover:bg-white hover:text-ink/70"
        }`}
        style={on ? { color: GOLD } : undefined}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <Star
            size={18}
            strokeWidth={on ? 1.5 : 2}
            fill={on ? GOLD : "none"}
          />
        )}
      </span>
    </button>
  );
}
