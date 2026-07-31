"use client";

import { useState } from "react";

/**
 * The site's own favicon, loaded straight from the origin — no third-party
 * icon service, so browsing a card never reports the domain to anyone else.
 * Sites that don't serve /favicon.ico fall back to the domain monogram.
 */
export function SiteIcon({
  src,
  domain,
  mark,
  color,
  size = 30,
}: {
  /** Icon URL resolved at extraction time; falls back to the conventional path. */
  src?: string | null;
  domain: string;
  /** Two-letter fallback drawn when the site has no reachable favicon. */
  mark: string;
  /** Monogram colour, matching the thumbnail gradient's foreground. */
  color: string;
  size?: number;
}) {
  const candidates = [src, domain ? `https://${domain}/favicon.ico` : null].filter(
    (value): value is string => Boolean(value),
  );
  const [attempt, setAttempt] = useState(0);
  const failed = attempt >= candidates.length;

  if (failed) {
    return (
      <span
        className="font-bold tracking-[-0.04em]"
        style={{ color, fontSize: size * 0.8 }}
      >
        {mark}
      </span>
    );
  }

  return (
    // Favicons come from arbitrary origins, so next/image would need each one
    // allow-listed — a plain img is the only thing that scales here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={candidates[attempt]}
      src={candidates[attempt]}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setAttempt((current) => current + 1)}
      className="rounded-[5px] bg-white/95 object-contain p-[3px] shadow-[0_1px_4px_rgba(14,32,24,0.25)]"
      style={{ width: size, height: size }}
    />
  );
}
