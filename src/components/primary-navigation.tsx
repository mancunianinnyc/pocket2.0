"use client";

import { Library, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/search", label: "Search", icon: Search },
  { href: "/ask", label: "Ask", icon: MessageCircle },
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
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 min-w-20 flex-col items-center gap-1 py-1.5 text-[11px] font-semibold ${
                active ? "text-ink" : "text-ink/62"
              }`}
            >
              <Icon size={20} strokeWidth={1.8} />
              {label}
              <span
                className={`h-[3px] w-5 rounded-full ${active ? "bg-lime" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    );
  }

  /* Plain words with a chartreuse underline for the current page — the
     header carries no pills or boxes. */
  return (
    <nav className="hidden h-16 items-stretch gap-9 md:flex">
      {navigation.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center border-b-[3px] pt-[3px] text-sm font-medium ${
              active
                ? "border-lime text-ink"
                : "border-transparent text-ink/62 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
