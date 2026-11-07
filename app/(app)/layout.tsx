// OWNER: Dev 1. Authenticated app shell: mobile-first, bottom navigation.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/shared/supabase/server";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/receipts/new", label: "Scanner" },
  { href: "/claims", label: "Réclamations" }, // Dev 2's pages
  { href: "/profile", label: "Profil" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-background">
        <ul className="mx-auto flex max-w-md justify-around py-3 text-sm">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="px-2 py-1">{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
