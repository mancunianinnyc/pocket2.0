import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getAppBaseUrl } from "@/lib/env";

const steps = [
  "Open Settings in Good Content, create an “iPhone Shortcut” token, and copy it.",
  "In Apple Shortcuts, create “Save to Good Content” and enable Show in Share Sheet for URLs.",
  "Add Get Contents of URL. Paste the request URL below and choose POST.",
  "Add Authorization: Bearer YOUR_CAPTURE_TOKEN and Content-Type: application/json headers.",
  "Set the JSON body field “url” to Shortcut Input, then save and test from Safari.",
];

export const metadata = {
  title: "iPhone Shortcut",
};

export default function IosShortcutPage() {
  const captureUrl = `${getAppBaseUrl().replace(/\/$/, "")}/api/capture`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6 md:pb-16">
      <Link
        href="/settings"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium text-ink/62 hover:text-ink"
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <div className="mt-6">
        <PageHeading
          title="Add Good Content to the Share Sheet."
          dek="Do this once. After that, saving any link is a single Share Sheet tap."
        />
      </div>

      <ol className="mt-10 border-t border-rule">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-5 border-b border-rule py-5">
            <span className="w-6 shrink-0 font-serif text-[26px] leading-none text-moss">
              {index + 1}
            </span>
            <p className="text-[15px] leading-6 text-ink/80">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 border-l-[3px] border-lime py-0.5 pl-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
          Request URL
        </p>
        <code className="mt-2 block select-all overflow-x-auto font-mono text-sm text-ink">
          {captureUrl}
        </code>
      </div>
    </main>
  );
}
