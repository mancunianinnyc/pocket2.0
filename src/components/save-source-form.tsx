"use client";

import { ArrowRight, LoaderCircle, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function SaveSourceForm({
  initialUrl = "",
  autoSave = false,
}: {
  initialUrl?: string;
  autoSave?: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAutomatically = useRef(false);

  const saveUrl = useCallback(async (value: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const result = (await response.json()) as {
        source?: { id: string };
        existing?: { id: string };
        error?: string;
      };

      if (!response.ok && response.status !== 409) {
        throw new Error(result.error || "Could not save that link.");
      }

      setUrl("");
      router.refresh();

      const sourceId = result.source?.id || result.existing?.id;
      if (sourceId) {
        router.push(`/library/${sourceId}`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save that link.",
      );
    } finally {
      setSaving(false);
    }
  }, [router]);

  useEffect(() => {
    if (autoSave && initialUrl && !startedAutomatically.current) {
      startedAutomatically.current = true;
      void saveUrl(initialUrl);
    }
  }, [autoSave, initialUrl, saveUrl]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveUrl(url);
  }

  return (
    <form onSubmit={submit}>
      {/* One hairline, not a box: the field reads as part of the page. */}
      <div className="flex items-center gap-2 border-b-[1.5px] border-ink/25 transition focus-within:border-moss">
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <Link2 className="shrink-0 text-ink/62" size={18} />
          <span className="sr-only">URL to save</span>
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a link worth keeping…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink/55"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-lime transition hover:bg-moss active:scale-[0.98] disabled:cursor-wait disabled:opacity-75"
        >
          {saving ? (
            <>
              <LoaderCircle className="animate-spin" size={16} />
              Saving…
            </>
          ) : (
            <>
              Save
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
