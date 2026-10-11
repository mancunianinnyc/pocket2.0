"use client";

import { Check, Copy, KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";

type TokenRecord = {
  id: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function CaptureTokenManager({
  initialTokens,
}: {
  initialTokens: TokenRecord[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("iPhone Shortcut");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createToken(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const result = (await response.json()) as {
      token?: string;
      record?: TokenRecord;
      error?: string;
    };
    setBusy(false);

    if (!response.ok || !result.token || !result.record) {
      setError(result.error || "Could not create a token.");
      return;
    }

    const record = result.record;
    setTokens((current) => [record, ...current]);
    setNewToken(result.token);
  }

  async function revokeToken(id: string) {
    setError(null);
    const response = await fetch(`/api/tokens?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Could not revoke that token.");
      return;
    }
    setTokens((current) =>
      current.map((token) =>
        token.id === id
          ? { ...token, revoked_at: new Date().toISOString() }
          : token,
      ),
    );
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  return (
    <div>
      {newToken ? (
        <div className="mb-6 border-l-[3px] border-amber-brand py-1 pl-4">
          <p className="text-sm font-semibold text-ink">
            Copy this token now — it won’t be shown again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate border-b border-rule py-2 font-mono text-xs text-ink">
              {newToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-lime hover:bg-moss"
              aria-label="Copy token"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={createToken}
        className="flex items-center gap-2 border-b-[1.5px] border-ink/25 transition focus-within:border-moss"
      >
        <label htmlFor="token-label" className="sr-only">
          Token label
        </label>
        <input
          id="token-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          required
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          placeholder="Token label"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-lime hover:bg-moss disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="animate-spin" size={16} /> : <KeyRound size={16} />}
          Create token
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-2">
        {tokens.length ? (
          tokens.map((token) => (
            <li
              key={token.id}
              className="flex items-center justify-between gap-4 border-b border-rule py-3"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${token.revoked_at ? "text-ink/62 line-through" : ""}`}>
                  {token.label}
                </p>
                <p className="mt-0.5 text-xs text-ink/70">
                  {token.revoked_at
                    ? "Revoked"
                    : token.last_used_at
                      ? `Last used ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(token.last_used_at))}`
                      : "Never used"}
                </p>
              </div>
              {!token.revoked_at ? (
                <button
                  type="button"
                  onClick={() => revokeToken(token.id)}
                  className="min-h-11 shrink-0 text-sm font-medium text-red-700 hover:text-red-900"
                  aria-label={`Revoke ${token.label}`}
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))
        ) : (
          <li className="py-4 font-serif text-[17px] italic text-ink/70">
            No capture tokens yet.
          </li>
        )}
      </ul>
    </div>
  );
}
