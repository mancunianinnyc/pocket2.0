import { SearchExperience } from "@/components/search-experience";

export const metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <p className="text-sm font-semibold text-clay">Hybrid retrieval</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
        Find the passage, not just the title.
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-ink/70">
        Search blends exact wording with conceptual similarity across every
        readable item.
      </p>
      <div className="mt-8">
        <SearchExperience />
      </div>
    </main>
  );
}
