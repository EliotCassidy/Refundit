// OWNER: Dev 1. Home: redirect to onboarding if no profile, otherwise "scan a receipt" + summary.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/shared/supabase/server";

export default async function HomePage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user!.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Bonjour {profile.first_name}</h1>
      <Link href="/receipts/new" className="rounded-xl bg-black px-4 py-6 text-center text-lg font-medium text-white">
        Scanner un ticket de caisse
      </Link>
      {/* TODO(dev1, P1): summary counts per claim status */}
    </div>
  );
}
