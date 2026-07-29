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
        <p className="text-sm font-semibold text-clay">Quick save</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">
          Adding this to your library.
        </h1>
        <p className="mt-3 text-ink/70">
          You can close this screen once the item opens.
        </p>
        <div className="mt-7">
          <SaveSourceForm initialUrl={url} autoSave={Boolean(url)} />
        </div>
      </section>
    </main>
  );
}
