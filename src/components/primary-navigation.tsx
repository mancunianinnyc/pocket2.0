"use client";

import { Library, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask", icon: Sparkles },
];

export function PrimaryNavigation({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <div className="mx-auto flex max-w-sm items-center justify-around">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 min-w-20 flex-col items-center gap-1 rounded-xl py-1.5 text-xs ${
                active ? "font-bold text-moss" : "text-ink/62"
              }`}
            >
              <Icon size={20} />
              {label}
              <span
                className={`h-0.5 w-5 rounded-full ${active ? "bg-lime" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="hidden items-center gap-1 rounded-full border border-ink/8 bg-white/70 p-1 md:flex">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
              active
                ? "bg-lime font-bold text-ink"
                : "text-ink/70 hover:text-ink"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
