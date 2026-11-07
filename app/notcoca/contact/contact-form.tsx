"use client";
// OWNER: Dev 2. NotCoca two-step contact form. Step 1: the request (product questions only when
// the reason is a product problem). Step 2: customer details. Native controls on purpose
// (labels, <select>, required) so it behaves like a real brand form for the H agent.
import { useState } from "react";
import { CIVILITIES, DRINKS, FORMATS, PACKAGINGS, PROBLEM_REASON, REASONS, YES_NO } from "@/lib/notcoca/catalog";

const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 focus:border-[#1F3BFF] focus:outline-none";
const label = "flex flex-col gap-1 text-sm font-medium";

function Select({ name, label: text, options, required = true }: { name: string; label: string; options: readonly string[]; required?: boolean }) {
  return (
    <label className={label}>
      <span>{text}{required && " *"}</span>
      <select name={name} required={required} defaultValue="" className={input}>
        <option value="" disabled>Veuillez sélectionner une option</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Field({ name, label: text, type = "text", required = true, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className={label}>
      <span>{text}{required && " *"}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className={input} />
    </label>
  );
}

export function ContactForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [stepOne, setStepOne] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  function next(formData: FormData) {
    setStepOne(Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])));
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const body = { ...stepOne, ...Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])), terms: formData.get("terms") === "on" };
    const res = await fetch("/api/notcoca/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) return setError(json?.error?.message ?? "Une erreur est survenue. Merci de réessayer.");
    setTicket(json.ticketNumber);
  }

  if (ticket) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl bg-green-50 p-5 text-green-900">
        <h3 className="text-lg font-bold">Merci, votre demande a bien été envoyée.</h3>
        <p>Numéro de votre demande : <strong>{ticket}</strong></p>
        <p className="text-sm">Notre service consommateurs vous répondra par e-mail dans les meilleurs délais.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex gap-2 text-xs font-semibold">
        <li className={`rounded-full px-3 py-1 ${step === 1 ? "bg-[#1F3BFF] text-white" : "bg-neutral-100"}`}>1. Votre demande</li>
        <li className={`rounded-full px-3 py-1 ${step === 2 ? "bg-[#1F3BFF] text-white" : "bg-neutral-100"}`}>2. Vos coordonnées</li>
      </ol>

      {step === 1 && (
        <form action={next} className="flex flex-col gap-4">
          <label className={label}>
            <span>Motif de votre demande *</span>
            <select name="reason" required value={reason} onChange={(e) => setReason(e.target.value)} className={input}>
              <option value="" disabled>Veuillez sélectionner une option (dans le menu déroulant)</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {reason === PROBLEM_REASON && (
            <>
              <Select name="still_has_product" label="Pouvez-vous confirmer que vous avez toujours la boisson concernée ?" options={YES_NO} />
              <Select name="drink" label="La réclamation porte sur quelle boisson ?" options={DRINKS} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="packaging" label="Veuillez sélectionner le packaging concerné" options={PACKAGINGS} />
                <Select name="format" label="Veuillez sélectionner le format concerné" options={FORMATS} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field name="quantity" label="Nombre de boissons concernées" type="number" required={false} />
                <Field name="best_before" label="DDM (à consommer de préférence avant)" required={false} placeholder="JJ/MM/AAAA" />
                <Field name="production_code" label="Code de production" required={false} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="store" label="Point de vente (magasin)" required={false} />
                <Field name="purchase_date" label="Date d'achat" type="date" />
              </div>
            </>
          )}

          <label className={label}>
            <span>Votre message *</span>
            <textarea name="message" required minLength={10} rows={6} className={input} />
          </label>

          <button className="self-start rounded-full bg-[#1F3BFF] px-6 py-2.5 font-semibold text-white">Continuer</button>
        </form>
      )}

      {step === 2 && (
        // onSubmit (not action): React 19 resets an action form after each submit, which would
        // wipe every field when the server rejects the request.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          <Select name="civility" label="Civilité" options={CIVILITIES} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="last_name" label="Nom" />
            <Field name="first_name" label="Prénom" />
          </div>
          <Field name="address" label="Adresse postale" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="postal_code" label="Code postal" />
            <Field name="city" label="Ville" />
          </div>
          <Field name="phone" label="Numéro de téléphone" type="tel" required={false} />
          <Field name="email" label="Adresse e-mail" type="email" />
          <Field name="email_confirm" label="Confirmez votre adresse e-mail" type="email" />
          <label className="flex items-start gap-2 text-sm">
            <input name="terms" type="checkbox" required className="mt-1" />
            <span>J&apos;ai lu et j&apos;accepte les conditions d&apos;utilisation. *</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-full border border-neutral-300 px-6 py-2.5 font-semibold">
              Retour
            </button>
            <button disabled={pending} className="rounded-full bg-[#1F3BFF] px-6 py-2.5 font-semibold text-white disabled:opacity-50">
              {pending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
