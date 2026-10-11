import { PageHeading } from "@/components/page-heading";
import { SearchExperience } from "@/components/search-experience";

export const metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <PageHeading
        title="Search"
        dek="Find the passage, not just the title — exact wording and half-remembered ideas both work."
      />
      <div className="mt-8">
        <SearchExperience />
      </div>
    </main>
  );
}
