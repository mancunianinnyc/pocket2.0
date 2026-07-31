"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SourceStatus } from "@/types/library";

const POLL_MS = 3_000;
/** Pipeline route caps at 300s; stop watching a little after that. */
const MAX_POLLS = 110;

/**
 * Saves return as soon as the row exists and finish extracting in the
 * background, so a reader opened straight after a save starts empty. Refresh
 * it until the source reaches a terminal state.
 */
export function ProcessingWatcher({ status }: { status: SourceStatus }) {
  const router = useRouter();
  const settled = status === "ready" || status === "failed";

  useEffect(() => {
    if (settled) return;

    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [settled, router]);

  return null;
}
