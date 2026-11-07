"use client";
// Shared UI. App navigation with active state (sidebar on desktop, top bar on mobile).
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Tableau de bord", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z" },
  { href: "/billing", label: "Abonnement", icon: "M3 7h18v10H3zM3 11h18M7 15h3" },
  { href: "/profile", label: "Profil", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/claims") : path.startsWith(href));

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-semibold transition ${
            isActive(path, i.href) ? "bg-ink text-surface" : "text-muted hover:bg-sunken hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
            <path d={i.icon} />
          </svg>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.slice(1).map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-label={i.label}
          className={`grid size-10 place-items-center rounded-full transition ${isActive(path, i.href) ? "bg-ink text-surface" : "text-ink hover:bg-sunken"}`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
            <path d={i.icon} />
          </svg>
        </Link>
      ))}
    </nav>
  );
}
