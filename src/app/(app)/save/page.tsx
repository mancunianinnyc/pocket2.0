import { PageHeading } from "@/components/page-heading";
import { SaveSourceForm } from "@/components/save-source-form";

export const metadata = {
  title: "Quick save",
};

export default async function SavePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url = "" } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 pb-28 md:pb-12">
      <section className="w-full">
        <PageHeading
          title={url ? "Saving this." : "Save a link."}
          dek="Reading happens in the background — you can close this straight away."
        />
        <div className="mt-8">
          <SaveSourceForm initialUrl={url} autoSave={Boolean(url)} />
        </div>
      </section>
    </main>
  );
}
