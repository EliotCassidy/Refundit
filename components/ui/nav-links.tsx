"use client";
// Shared UI. App navigation with active state (sidebar on desktop, icon bar on mobile).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutDashboard, User, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Tableau de bord", Icon: LayoutDashboard },
  { href: "/billing", label: "Abonnement", Icon: CreditCard },
  { href: "/profile", label: "Profil", Icon: User },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/claims") : path.startsWith(href));

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition ${
              active ? "bg-sunken font-semibold text-ink" : "font-medium text-muted hover:bg-sunken/60 hover:text-ink"
            }`}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.slice(1).map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          className={`grid size-9 place-items-center rounded-full transition ${isActive(path, href) ? "bg-sunken text-ink" : "text-muted hover:text-ink"}`}
        >
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </Link>
      ))}
    </nav>
  );
}
