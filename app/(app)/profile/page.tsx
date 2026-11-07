// OWNER: Dev 1. Voir / modifier le profil + déconnexion.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { ProfileForm, type ProfileValues } from "./profile-form";
import { SignOutButton } from "./sign-out-button";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, address_line1, address_line2, postal_code, city, country")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const values: ProfileValues = {
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone ?? "",
    address_line1: profile.address_line1,
    address_line2: profile.address_line2 ?? "",
    postal_code: profile.postal_code,
    city: profile.city,
    country: profile.country,
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Profil</h1>
      <p className="-mt-3 text-sm text-muted">Ces informations servent à remplir les formulaires des marques.</p>
      <ProfileForm values={values} />
      <div className="flex flex-col gap-3 border-t border-line-strong/50 pt-4">
        <Link href="/billing" className="text-sm underline">Mon abonnement</Link>
        <SignOutButton />
      </div>
    </div>
  );
}
