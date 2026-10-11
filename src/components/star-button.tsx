"use client";

import { LoaderCircle, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Gold rather than a brand colour — "starred" has to read at a glance. */
const GOLD = "#f2b32c";

/**
 * Starring publishes a source to the public reading page, so the control says
 * so on the reader. In library rows it is icon-only for fast triage down a long list.
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
        className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition ${
          on ? "text-ink" : "text-ink/70 hover:text-moss"
        }`}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={15} />
        ) : (
          <Star
            size={15}
            strokeWidth={on ? 1.4 : 1.8}
            fill={on ? GOLD : "none"}
            color={on ? "#0e2018" : "currentColor"}
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
      className={`flex size-11 items-center justify-center rounded-full transition ${
        on ? "" : "text-ink/50 hover:text-ink/80"
      }`}
    >
      {busy ? (
        <LoaderCircle className="animate-spin" size={17} />
      ) : (
        <Star
          size={18}
          strokeWidth={on ? 1.4 : 1.8}
          fill={on ? GOLD : "none"}
          color={on ? "#0e2018" : "currentColor"}
        />
      )}
    </button>
  );
}
