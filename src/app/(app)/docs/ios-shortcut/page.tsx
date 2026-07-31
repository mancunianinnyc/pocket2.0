import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const steps = [
  "Open Settings in Good Content, create an “iPhone Shortcut” token, and copy it.",
  "In Apple Shortcuts, create “Save to Good Content” and enable Show in Share Sheet for URLs.",
  "Add Get Contents of URL. Use your production /api/capture URL and choose POST.",
  "Add Authorization: Bearer YOUR_CAPTURE_TOKEN and Content-Type: application/json headers.",
  "Set the JSON body field “url” to Shortcut Input, then save and test from Safari.",
];

export const metadata = {
  title: "iPhone Shortcut",
};

export default function IosShortcutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 md:pb-16">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70 hover:text-moss"
      >
        <ArrowLeft size={17} />
        Settings
      </Link>
      <p className="mt-8 text-sm font-semibold text-clay">iOS capture</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">
        Add Good Content to the Share Sheet.
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-ink/70">
        Do this once. Afterward, saving any Safari link is a single Share Sheet
        action.
      </p>

      <ol className="mt-8 space-y-4">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex gap-4 rounded-2xl border border-ink/8 bg-white/70 p-5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-moss">
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-6 text-ink/70">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-ink p-5 text-sm text-paper">
        <p className="font-semibold">Request URL</p>
        <code className="mt-2 block overflow-x-auto font-mono text-xs text-paper/70">
          https://YOUR-VERCEL-DOMAIN/api/capture
        </code>
      </div>
    </main>
  );
}
