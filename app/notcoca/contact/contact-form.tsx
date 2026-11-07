"use client";
// OWNER: Dev 2. NotCoca two-step contact form, kept short (essentials only). Step 1: the request, with
// "do you still have the drink?" first (the agent can't answer it → it stops early and asks the user). Step 2: name + email. Native controls on purpose
// (labels, <select>, required) so it behaves like a real brand form for the H agent.
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Send } from "lucide-react";
import { DRINKS, FORMATS, PROBLEM_REASON, REASONS, YES_NO } from "@/lib/notcoca/catalog";

const control =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-notcoca focus:bg-white focus:outline-none focus:ring-4 focus:ring-notcoca/15";
const input = `h-12 ${control}`;
const area = `min-h-36 py-3 ${control}`;
const label = "flex flex-col gap-1.5 text-sm font-semibold text-neutral-800";
const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-notcoca px-7 font-bold text-white shadow-lg shadow-notcoca/30 transition hover:-translate-y-0.5 hover:bg-notcoca-dark disabled:translate-y-0 disabled:opacity-50";

/** Liste déroulante native (l'agent H la lit comme sur un vrai site), avec une flèche dessinée. */
function SelectBox(props: React.ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={`${input} cursor-pointer appearance-none pr-11`} />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
    </span>
  );
}

function Select({ name, label: text, options, required = true }: { name: string; label: string; options: readonly string[]; required?: boolean }) {
  return (
    <label className={label}>
      <span>{text}{required && " *"}</span>
      <SelectBox name={name} required={required} defaultValue="">
        <option value="" disabled>Veuillez sélectionner une option</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </SelectBox>
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
      <div role="status" className="flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-5 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-notcoca text-white shadow-lg shadow-notcoca/30">
          <Check className="size-7" aria-hidden />
        </span>
        <h3 className="text-xl font-bold">Merci, votre demande a bien été envoyée.</h3>
        <p>Numéro de votre demande : <strong className="rounded-lg bg-white px-2 py-0.5 font-mono ring-1 ring-black/10">{ticket}</strong></p>
        <p className="max-w-sm text-sm text-neutral-600">Notre service consommateurs vous répondra par e-mail dans les meilleurs délais.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="grid grid-cols-2 gap-3">
        {["Votre demande", "Vos coordonnées"].map((t, i) => {
          const n = (i + 1) as 1 | 2;
          return (
            <li key={t} className="flex flex-col gap-2">
              <span className={`h-1.5 rounded-full transition-colors ${step >= n ? "bg-notcoca" : "bg-neutral-200"}`} />
              <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${step === n ? "text-notcoca" : "text-neutral-400"}`}>
                <span className={`grid size-6 place-items-center rounded-full text-[11px] ${step >= n ? "bg-notcoca text-white" : "bg-neutral-200 text-neutral-500"}`}>
                  {step > n ? <Check className="size-3.5" aria-hidden /> : n}
                </span>
                {n}. {t}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <form action={next} className="flex flex-col gap-4">
          <label className={label}>
            <span>Motif de votre demande *</span>
            <SelectBox name="reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="" disabled>Veuillez sélectionner une option (dans le menu déroulant)</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectBox>
          </label>

          {reason === PROBLEM_REASON && (
            <div className="flex flex-col gap-4 rounded-3xl bg-notcoca/[0.04] p-4 ring-1 ring-notcoca/10 sm:p-5">
              <Select name="still_has_product" label="Pouvez-vous confirmer que vous avez toujours la boisson concernée ?" options={YES_NO} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="drink" label="Boisson concernée" options={DRINKS} />
                <Select name="format" label="Format" options={FORMATS} />
              </div>
            </div>
          )}

          <label className={label}>
            <span>Votre message *</span>
            <textarea name="message" required minLength={10} rows={4} className={area} />
          </label>

          <button className={`${primary} self-start`}>
            Continuer <ArrowRight className="size-4" aria-hidden />
          </button>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="last_name" label="Nom" />
            <Field name="first_name" label="Prénom" />
          </div>
          <Field name="email" label="Adresse e-mail" type="email" />
          <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm">
            <input name="terms" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-notcoca" />
            <span>J&apos;ai lu et j&apos;accepte les conditions d&apos;utilisation. *</span>
          </label>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-neutral-300 px-6 font-bold transition hover:border-neutral-900"
            >
              <ArrowLeft className="size-4" aria-hidden /> Retour
            </button>
            <button disabled={pending} className={primary}>
              {pending ? "Envoi…" : "Envoyer"} {!pending && <Send className="size-4" aria-hidden />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
