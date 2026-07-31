"use client";

import { LoaderCircle, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
            ? "border-moss/30 bg-lime text-ink"
            : "border-ink/10 bg-white/70 text-ink/70 hover:border-moss/30 hover:text-moss"
        }`}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={15} />
        ) : (
          <Star size={15} fill={on ? "currentColor" : "none"} />
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
      className={`flex size-11 items-center justify-center rounded-full transition ${
        on
          ? "text-moss"
          : "text-ink/35 hover:text-moss sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      }`}
    >
      {busy ? (
        <LoaderCircle className="animate-spin" size={18} />
      ) : (
        <Star
          size={19}
          fill={on ? "currentColor" : "none"}
          className={on ? "" : "drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"}
        />
      )}
    </button>
  );
}
