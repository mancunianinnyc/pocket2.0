"use client";

import { ArrowUpRight, LoaderCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AskAnswer } from "@/types/search";

export function AskExperience() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer(null);
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const result = (await response.json()) as {
      answer?: AskAnswer;
      error?: string;
    };
    setLoading(false);
    if (!response.ok || !result.answer) {
      setError(result.error || "Could not answer that question.");
      return;
    }
    setAnswer(result.answer);
  }

  return (
    <div>
      <form onSubmit={submit}>
        <div className="rounded-[1.4rem] border-[1.5px] border-ink/14 bg-white p-2 shadow-sm transition focus-within:border-moss focus-within:shadow-[0_0_0_3px_rgba(217,244,92,0.6)]">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            required
            minLength={3}
            rows={3}
            placeholder="What did I save about…"
            className="w-full resize-none bg-transparent px-3 py-2 text-[17px] leading-7 outline-none placeholder:text-ink/55"
          />
          <div className="flex justify-end border-t border-ink/7 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-ink px-4 text-sm font-semibold text-lime transition hover:bg-moss disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
              Ask my library
            </button>
          </div>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {answer ? (
        <section className="mt-7 rounded-[1.5rem] border border-ink/8 bg-white/75 p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-bold text-moss">
            <span className="flex size-7 items-center justify-center rounded-lg bg-lime text-ink">
              <Sparkles size={15} />
            </span>
            Answer from your library
          </div>
          {answer.insufficient_evidence ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The available evidence is incomplete, so treat this as a limited answer.
            </p>
          ) : null}
          <p className="mt-5 whitespace-pre-wrap text-[17px] leading-8 text-ink/78">
            {answer.answer}
          </p>

          {answer.citations.length ? (
            <div className="mt-7 border-t border-ink/8 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/62">
                Evidence
              </p>
              <div className="mt-3 grid gap-2">
                {answer.citations.map((citation, index) => (
                  <Link
                    key={`${citation.source_id}-${citation.chunk_index}-${index}`}
                    href={`/library/${citation.source_id}`}
                    className="group rounded-[14px] border-l-[3px] border-lime bg-cream/70 p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <p className="text-xs font-semibold text-moss">
                        {index + 1}. {citation.title || "Untitled source"}
                      </p>
                      <ArrowUpRight className="shrink-0 text-ink/25 group-hover:text-moss" size={16} />
                    </div>
                    <blockquote className="mt-2 text-sm leading-6 text-ink/62">
                      “{citation.quote}”
                    </blockquote>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
