import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { sendMagicLink } from "./actions";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-moss text-white shadow-sm">
            <BookOpen size={21} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-semibold text-moss">Personal Library</p>
            <p className="text-xs text-ink/70">Keep the useful part.</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-ink/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(42,57,48,0.10)] backdrop-blur sm:p-8">
          {sent ? (
            <div className="py-4">
              <CheckCircle2 className="mb-5 text-moss" size={36} strokeWidth={1.6} />
              <h1 className="text-3xl font-semibold tracking-[-0.035em] text-ink">
                Check your inbox
              </h1>
              <p className="mt-3 leading-7 text-ink/65">
                We sent a private sign-in link to{" "}
                <span className="font-medium text-ink">{sent}</span>.
              </p>
              <a
                href="/login"
                className="mt-7 inline-flex text-sm font-semibold text-moss hover:text-moss-dark"
              >
                Use another email
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-clay">Welcome back</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-ink">
                Find what you saved.
              </h1>
              <p className="mt-4 leading-7 text-ink/70">
                Sign in with a magic link. No password to remember.
              </p>

              {error ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form action={sendMagicLink} className="mt-8">
                <label htmlFor="email" className="text-sm font-medium text-ink/75">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="mt-2 h-12 w-full rounded-xl border border-ink/12 bg-paper/60 px-4 text-[16px] outline-none transition focus:border-moss focus:ring-3 focus:ring-moss/10"
                />
                <button
                  type="submit"
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-moss px-5 font-semibold text-white transition hover:bg-moss-dark active:scale-[0.99]"
                >
                  Send magic link
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
