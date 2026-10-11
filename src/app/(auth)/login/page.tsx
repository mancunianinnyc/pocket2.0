import { ArrowRight } from "lucide-react";
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
        <p className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-3 rounded-[3px] bg-lime shadow-[inset_0_0_0_1.5px_#0e2018]"
          />
          <span className="font-serif text-[21px] font-semibold tracking-[-0.01em]">
            Good Content
          </span>
        </p>

        {sent ? (
          <div className="mt-12">
            <h1 className="font-serif text-[44px] font-medium leading-[1.04] tracking-[-0.025em]">
              Check your inbox.
            </h1>
            <p className="mt-4 font-serif text-lg italic leading-relaxed text-ink/70">
              A private sign-in link is on its way to{" "}
              <span className="not-italic text-ink">{sent}</span>.
            </p>
            <a
              href="/login"
              className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-moss hover:text-ink"
            >
              Use another email
            </a>
          </div>
        ) : (
          <div className="mt-12">
            <h1 className="font-serif text-[44px] font-medium leading-[1.04] tracking-[-0.025em] sm:text-[52px]">
              Find what you saved.
            </h1>
            <p className="mt-4 font-serif text-lg italic leading-relaxed text-ink/70">
              Sign in with a magic link — no password to remember.
            </p>

            {error ? (
              <p className="mt-6 border-l-[3px] border-red-700 py-0.5 pl-4 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <form action={sendMagicLink} className="mt-10">
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
                className="mt-1 h-12 w-full border-b-[1.5px] border-ink/25 bg-transparent text-[16px] outline-none transition placeholder:text-ink/55 focus:border-moss"
              />
              <button
                type="submit"
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-lime transition hover:bg-moss active:scale-[0.99]"
              >
                Send magic link
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
