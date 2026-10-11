"use client";

import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceActions({
  sourceId,
  canRetry,
}: {
  sourceId: string;
  canRetry: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy("retry");
    setError(null);
    const response = await fetch(`/api/sources/${sourceId}/retry`, {
      method: "POST",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Retry failed.");
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  async function remove() {
    if (!window.confirm("Delete this source and all of its derived data?")) {
      return;
    }
    setBusy("delete");
    setError(null);
    const response = await fetch(`/api/sources/${sourceId}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Delete failed.");
      setBusy(null);
      return;
    }
    router.push("/library");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule pt-4">
        {canRetry ? (
          <button
            type="button"
            onClick={retry}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-lime hover:bg-moss disabled:opacity-60"
          >
            {busy === "retry" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Retry
          </button>
        ) : null}
        <button
          type="button"
          onClick={remove}
          disabled={Boolean(busy)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
        >
          {busy === "delete" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Trash2 size={16} />
          )}
          Delete
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
