"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareOriginalButton({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported payload — fall through to clipboard.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-moss"
    >
      {copied ? <Check size={15} className="text-moss" /> : <Share2 size={15} />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
