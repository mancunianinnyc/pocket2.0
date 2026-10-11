"use client";

import { LoaderCircle, Send } from "lucide-react";
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
        <div className="border-b-[1.5px] border-ink/25 transition focus-within:border-moss">
          <label htmlFor="ask-question" className="sr-only">
            Your question
          </label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            required
            minLength={3}
            rows={3}
            placeholder="What did I save about…"
            className="w-full resize-none bg-transparent py-2 font-serif text-[20px] leading-[1.5] outline-none placeholder:italic placeholder:text-ink/55"
          />
          <div className="flex justify-end pb-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-lime transition hover:bg-moss disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {loading ? "Reading your library…" : "Ask"}
            </button>
          </div>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {answer ? (
        <section className="mt-10" aria-label="Answer">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
            From your library
          </h2>
          {answer.insufficient_evidence ? (
            <p className="mt-4 border-l-[3px] border-amber-brand py-0.5 pl-4 text-sm leading-6 text-ink/75">
              The evidence is incomplete, so treat this as a limited answer.
            </p>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap font-serif text-[19px] leading-[1.7] text-ink/90 sm:text-[20px]">
            {answer.answer}
          </p>

          {answer.citations.length ? (
            <div className="mt-10">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/62">
                Evidence
              </h3>
              <ol className="mt-2">
                {answer.citations.map((citation, index) => (
                  <li
                    key={`${citation.source_id}-${citation.chunk_index}-${index}`}
                    className="border-b border-rule"
                  >
                    <Link
                      href={`/library/${citation.source_id}`}
                      className="group flex gap-4 py-4"
                    >
                      <span className="w-5 shrink-0 pt-0.5 font-serif text-[17px] text-moss">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-serif text-[18px] font-medium leading-[1.3] text-ink group-hover:text-moss">
                          {citation.title || "Untitled source"}
                        </span>
                        <blockquote className="mt-1.5 font-serif text-[15px] italic leading-[1.55] text-ink/70">
                          “{citation.quote}”
                        </blockquote>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
