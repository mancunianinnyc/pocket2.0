import { AskExperience } from "@/components/ask-experience";
import { PageHeading } from "@/components/page-heading";

export const metadata = {
  title: "Ask",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <PageHeading
        title="Ask"
        dek="Answers come only from what you’ve saved, and every claim points back to the passage it rests on."
      />
      <div className="mt-8">
        <AskExperience />
      </div>
    </main>
  );
}
