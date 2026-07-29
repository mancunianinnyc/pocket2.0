import { BookOpen, LogOut, Settings } from "lucide-react";
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
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-paper/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/library" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-lime text-ink">
              <BookOpen size={18} strokeWidth={1.8} />
            </span>
            <span className="font-bold tracking-[-0.02em]">Personal Library</span>
          </Link>

          <PrimaryNavigation />

          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex size-11 items-center justify-center rounded-xl text-ink/62 hover:bg-cream hover:text-ink"
            >
              <Settings size={19} />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label={`Sign out ${email}`}
                title={`Sign out ${email}`}
                className="flex size-11 items-center justify-center rounded-xl text-ink/62 hover:bg-cream hover:text-ink sm:size-auto sm:h-11 sm:max-w-32 sm:px-3 sm:text-sm"
              >
                <LogOut className="sm:hidden" size={19} />
                <span className="hidden truncate sm:block">{email}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-paper/92 px-5 py-2 backdrop-blur-xl md:hidden">
        <PrimaryNavigation mobile />
      </nav>
    </div>
  );
}
