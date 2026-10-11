import { LogOut, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrimaryNavigation } from "@/components/primary-navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : "Signed in";

  if (!data?.claims?.sub) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/library" className="flex min-h-11 items-center gap-2.5">
            <span
              aria-hidden
              className="size-3 rounded-[3px] bg-lime shadow-[inset_0_0_0_1.5px_#0e2018]"
            />
            <span className="font-serif text-[21px] font-semibold tracking-[-0.01em]">
              Good Content
            </span>
          </Link>

          <PrimaryNavigation />

          <div className="flex items-center gap-1">
            <Link
              href="/save"
              aria-label="Save a link"
              className="flex size-11 items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-semibold text-lime hover:bg-moss sm:mr-2 sm:h-10 sm:w-auto sm:px-4"
            >
              <Plus size={17} strokeWidth={2.4} />
              <span className="hidden sm:inline">Save</span>
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex size-11 items-center justify-center rounded-full text-ink/62 hover:text-ink"
            >
              <Settings size={19} />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label={`Sign out ${email}`}
                title={`Sign out ${email}`}
                className="flex size-11 items-center justify-center rounded-full text-ink/62 hover:text-ink"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
        <PrimaryNavigation mobile />
      </nav>
    </div>
  );
}
