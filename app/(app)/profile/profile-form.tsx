"use client";
// OWNER: Dev 1. Profil : mêmes champs que l'onboarding, pré-remplis et modifiables (POST /api/profile).
import { useState } from "react";
import { Field } from "@/components/ui/field";

export type ProfileValues = {
  first_name: string;
  last_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
};

export function ProfileForm({ values }: { values: ProfileValues }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setSaved(false);
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
    setPending(false);
    setSaved(true);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Field name="first_name" label="Prénom" autoComplete="given-name" defaultValue={values.first_name} required />
        <Field name="last_name" label="Nom" autoComplete="family-name" defaultValue={values.last_name} required />
      </div>
      <Field name="phone" label="Téléphone" type="tel" autoComplete="tel" defaultValue={values.phone} required />
      <Field name="address_line1" label="Adresse" autoComplete="address-line1" defaultValue={values.address_line1} required />
      <Field name="address_line2" label="Complément d'adresse" optional autoComplete="address-line2" defaultValue={values.address_line2} />
      <div className="flex gap-3">
        <Field name="postal_code" label="Code postal" autoComplete="postal-code" defaultValue={values.postal_code} required />
        <Field name="city" label="Ville" autoComplete="address-level2" defaultValue={values.city} required />
      </div>
      <Field name="country" label="Pays" autoComplete="country-name" defaultValue={values.country} required />

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="rounded-xl bg-green-500/10 p-3 text-sm text-green-600">Profil enregistré.</p>}

      <button disabled={pending} className="rounded-xl bg-foreground px-4 py-4 text-lg font-medium text-background disabled:opacity-40">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
