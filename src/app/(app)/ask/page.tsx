import { AskExperience } from "@/components/ask-experience";

export const metadata = {
  title: "Ask",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <p className="text-sm font-semibold text-clay">Ask my library</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
        Ask what your reading already knows.
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-ink/70">
        Answers stay inside your saved evidence and link every material claim
        back to an exact passage.
      </p>
      <div className="mt-8">
        <AskExperience />
      </div>
    </main>
  );
}
