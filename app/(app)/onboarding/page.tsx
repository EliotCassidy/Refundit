// OWNER: Dev 1. Onboarding : crée la ligne profiles de l'utilisateur, puis accueil.
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Quelques informations</h1>
        <p className="mt-1 text-sm text-muted">Pour créer votre compte, il nous faut votre nom et votre adresse.</p>
      </div>
      <p className="rounded-[20px] bg-sunken p-3 text-sm">
        Ces informations servent à remplir les formulaires des marques. Les marques vous répondent sur une adresse email
        dédiée, jamais la vôtre.
      </p>
      <OnboardingForm />
    </div>
  );
}
