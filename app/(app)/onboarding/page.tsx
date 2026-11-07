// Onboarding: animated wizard that creates the user's profile, then the dashboard.
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");
  return <OnboardingWizard />;
}
