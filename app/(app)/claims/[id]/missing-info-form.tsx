"use client";
// OWNER: Dev 2. Asks the user for the fields the brand's form required, then resubmits.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MissingInfoForm({ claimId, fields, answers }: { claimId: string; fields: string[]; answers: Record<string, string> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const values = Object.fromEntries(
      fields.map((f) => [f, String(formData.get(f) ?? "").trim()]).filter(([, v]) => v),
    );
    const res = await fetch(`/api/claims/${claimId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: values }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) setError(body?.error?.message ?? "Erreur");
    else if (body?.remaining?.length) setError(`Il manque encore : ${body.remaining.join(", ")}`);
    setPending(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div>
        <h2 className="font-medium text-amber-900">La marque demande des informations</h2>
        <p className="text-sm text-amber-900/80">
          Elles figurent en général sur l&apos;emballage. Dès que vous les renseignez, l&apos;agent renvoie la réclamation.
        </p>
      </div>
      <form action={onSubmit} className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{f}</span>
            <input
              name={f}
              defaultValue={answers[f] ?? ""}
              required
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={pending} className="rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-50">
          {pending ? "Envoi…" : "Compléter et renvoyer"}
        </button>
      </form>
    </section>
  );
}
