// Authenticated app shell: sidebar on desktop, top bar on mobile, floating "Scanner" button.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/brand";
import { SideNav, TopNav } from "@/components/ui/nav-links";
import { ScanFab } from "@/components/ui/scan-fab";
import { getUser } from "@/lib/shared/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 bg-surface">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line px-5 py-6 md:flex">
        <Link href="/" aria-label="Refundit, tableau de bord"><Logo /></Link>
        <SideNav />
        <Link
          href="/receipts/new"
          className="mt-auto rounded-[14px] bg-ink px-4 py-3 text-center text-sm font-bold text-surface transition hover:opacity-90"
        >
          Scanner un ticket
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur md:hidden">
          <Link href="/" aria-label="Refundit, tableau de bord"><Logo /></Link>
          <TopNav />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-5 md:px-8 md:pb-16 md:pt-8">{children}</main>
      </div>

      <ScanFab />
    </div>
  );
}
