// Authenticated app shell: white sidebar on desktop, top bar on mobile, floating "Scanner" on mobile.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Logo } from "@/components/ui/brand";
import { SideNav, TopNav } from "@/components/ui/nav-links";
import { ScanFab } from "@/components/ui/scan-fab";
import { getUser } from "@/lib/shared/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 bg-surface">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-7 border-r border-line bg-raised px-4 py-5 md:flex">
        <Link href="/" aria-label="Refundit, tableau de bord" className="px-2"><Logo /></Link>
        <Link
          href="/receipts/new"
          className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition hover:brightness-95"
        >
          <ScanLine className="size-4" strokeWidth={2.2} aria-hidden />
          Scanner un ticket
        </Link>
        <SideNav />
        <p className="mt-auto px-2 text-xs text-muted">{user.email}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" aria-label="Refundit, tableau de bord"><Logo /></Link>
          <TopNav />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-16 md:pt-10">{children}</main>
      </div>

      <ScanFab />
    </div>
  );
}
