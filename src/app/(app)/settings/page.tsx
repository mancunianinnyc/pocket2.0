import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CaptureTokenManager } from "@/components/capture-token-manager";
import { PageHeading } from "@/components/page-heading";
import { getAppBaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: tokens } = userId
    ? await supabase
        .from("capture_tokens")
        .select("id, label, last_used_at, created_at, revoked_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const baseUrl = getAppBaseUrl().replace(/\/$/, "");
  const bookmarklet = `javascript:(()=>{window.open('${baseUrl}/save?url='+encodeURIComponent(location.href),'_blank','noopener,noreferrer')})()`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 md:pb-16">
      <PageHeading
        title="Settings"
        dek="Capture from anywhere. Every route lands in the same private library."
      />

      <div className="mt-10 border-t border-rule">
        <section className="border-b border-rule py-8">
          <h2 className="font-serif text-[26px] font-medium tracking-[-0.015em]">
            iPhone Shortcut
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink/70">
            Save from any app’s Share Sheet in one tap. Takes about two minutes:
            create a token below, then follow the recipe.
          </p>
          <Link
            href="/docs/ios-shortcut"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-moss hover:text-ink"
          >
            Open the setup recipe
            <ArrowRight size={15} />
          </Link>
        </section>

        <section className="border-b border-rule py-8">
          <h2 className="font-serif text-[26px] font-medium tracking-[-0.015em]">
            Capture tokens
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink/70">
            For the iPhone Shortcut and personal automations. Each device gets
            its own, so one can be revoked without touching the rest.
          </p>
          <div className="mt-6">
            <CaptureTokenManager initialTokens={tokens ?? []} />
          </div>
        </section>

        <section className="border-b border-rule py-8">
          <h2 className="font-serif text-[26px] font-medium tracking-[-0.015em]">
            Desktop bookmarklet
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink/70">
            Drag this to your bookmarks bar; click it on any page to save it.
          </p>
          <a
            href={bookmarklet}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-lime hover:bg-moss"
          >
            Save to Good Content
          </a>
        </section>
      </div>
    </main>
  );
}
