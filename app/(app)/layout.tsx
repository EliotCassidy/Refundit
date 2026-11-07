// Authenticated app shell: no sidebar. Logo top left, "Compte" menu top right, floating "Scanner".
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/ui/account-menu";
import { Aurora } from "@/components/ui/aurora";
import { Logo } from "@/components/ui/brand";
import { ScanFab } from "@/components/ui/scan-fab";
import { DemoTour } from "@/components/demo/demo-tour";
import { createClient, getUser } from "@/lib/shared/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name, subscription_status").eq("id", user.id).maybeSingle();
  const unlimited = ["active", "trialing"].includes(profile?.subscription_status ?? "");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Aurora />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" aria-label="Refundit, tableau de bord"><Logo /></Link>
          <AccountMenu firstName={profile?.first_name ?? null} email={user.email ?? ""} unlimited={unlimited} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-24 md:pt-10">{children}</main>
      <ScanFab />
      <DemoTour />
    </div>
  );
}
