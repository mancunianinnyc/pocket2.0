import { Bookmark, ExternalLink, KeyRound, Smartphone } from "lucide-react";
import { CaptureTokenManager } from "@/components/capture-token-manager";
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
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 md:pb-16">
      <p className="text-sm font-semibold text-clay">Settings</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">
        Capture from anywhere.
      </h1>
      <p className="mt-3 max-w-xl leading-7 text-ink/70">
        The quickest capture method depends on the device. Each one lands in the
        same private library.
      </p>

      <div className="mt-8 grid gap-4">
        <section className="rounded-[1.4rem] border border-ink/8 bg-white/72 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sage text-moss">
              <KeyRound size={19} />
            </span>
            <div>
              <h2 className="font-semibold">Capture API tokens</h2>
              <p className="text-sm text-ink/70">For iOS Shortcuts and personal automations.</p>
            </div>
          </div>
          <div className="mt-5">
            <CaptureTokenManager initialTokens={tokens ?? []} />
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-ink/8 bg-white/72 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sage text-moss">
              <Smartphone size={19} />
            </span>
            <div>
              <h2 className="font-semibold">iPhone Shortcut</h2>
              <p className="text-sm text-ink/70">A two-minute Share Sheet setup.</p>
            </div>
          </div>
          <a
            href="/docs/ios-shortcut"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-moss hover:text-moss-dark"
          >
            Open setup recipe
            <ExternalLink size={15} />
          </a>
        </section>

        <section className="rounded-[1.4rem] border border-ink/8 bg-white/72 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sage text-moss">
              <Bookmark size={19} />
            </span>
            <div>
              <h2 className="font-semibold">Desktop bookmarklet</h2>
              <p className="text-sm text-ink/70">Drag this link to your bookmarks bar.</p>
            </div>
          </div>
          <a
            href={bookmarklet}
            className="mt-5 inline-flex rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save to Personal Library
          </a>
        </section>
      </div>
    </main>
  );
}
