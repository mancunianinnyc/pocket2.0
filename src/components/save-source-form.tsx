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
      <div className="flex flex-col gap-3 rounded-[1.4rem] border-[1.5px] border-ink/14 bg-white p-2 shadow-[0_20px_55px_rgba(14,32,24,0.12)] transition focus-within:border-moss focus-within:shadow-[0_0_0_3px_rgba(217,244,92,0.6),0_20px_55px_rgba(14,32,24,0.12)] sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <Link2 className="shrink-0 text-moss" size={19} />
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
          className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-ink px-5 font-semibold text-lime transition hover:bg-moss active:scale-[0.98] disabled:cursor-wait disabled:opacity-75"
        >
          {saving ? (
            <>
              <LoaderCircle className="animate-spin" size={18} />
              Saving…
            </>
          ) : (
            <>
              Save
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
