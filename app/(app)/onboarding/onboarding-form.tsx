"use client";
// OWNER: Dev 1. Onboarding : crée le profil (POST /api/profile) puis redirection vers l'accueil.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";

export function OnboardingForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setPending(false);
      setError(body?.error?.message ?? "Enregistrement impossible. Réessayez.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Field name="first_name" label="Prénom" autoComplete="given-name" required />
        <Field name="last_name" label="Nom" autoComplete="family-name" required />
      </div>
      <Field name="phone" label="Téléphone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" required />
      <Field name="address_line1" label="Adresse" autoComplete="address-line1" placeholder="12 rue des Roses" required />
      <Field name="address_line2" label="Complément d'adresse" optional autoComplete="address-line2" placeholder="Bis, résidence…" />
      <div className="flex gap-3">
        <Field name="postal_code" label="Code postal" autoComplete="postal-code" placeholder="75011" required />
        <Field name="city" label="Ville" autoComplete="address-level2" placeholder="Paris" required />
      </div>
      <Field name="country" label="Pays" autoComplete="country-name" defaultValue="FR" required />

      {error && <p className="rounded-[20px] bg-danger-soft p-3 text-sm text-on-danger-soft">{error}</p>}

      <button disabled={pending} className="rounded-[20px] bg-ink px-4 py-4 text-lg font-medium text-surface disabled:opacity-40">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
