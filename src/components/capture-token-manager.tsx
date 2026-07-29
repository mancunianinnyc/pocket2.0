"use client";

import { Check, Copy, KeyRound, LoaderCircle, X } from "lucide-react";
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
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Copy this token now. It will not be shown again.
          </p>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-ink">
              {newToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-moss text-white"
              aria-label="Copy token"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={createToken} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          required
          className="h-11 min-w-0 flex-1 rounded-xl border border-ink/12 bg-paper/55 px-3 text-[16px] outline-none focus:border-moss"
          placeholder="Token label"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-moss px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="animate-spin" size={16} /> : <KeyRound size={16} />}
          Create token
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 divide-y divide-ink/8">
        {tokens.length ? (
          tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{token.label}</p>
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
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink/62 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Revoke ${token.label}`}
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="py-5 text-sm text-ink/70">No capture tokens yet.</p>
        )}
      </div>
    </div>
  );
}
