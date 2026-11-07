// Profile: identity card + grouped settings (identity, contact, refunds IBAN, account).
import { redirect } from "next/navigation";
import { maskIban } from "@/lib/shared/iban";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { ProfileForm, type ProfileValues } from "./profile-form";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, civility, phone, address_line1, address_line2, postal_code, city, country, iban, subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const values: ProfileValues = {
    civility: (profile.civility as ProfileValues["civility"]) ?? null,
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
    <ProfileForm
      values={values}
      email={user.email ?? ""}
      // Only the masked IBAN reaches the browser.
      maskedIban={profile.iban ? maskIban(profile.iban) : null}
      unlimited={["active", "trialing"].includes(profile.subscription_status ?? "")}
    />
  );
}
