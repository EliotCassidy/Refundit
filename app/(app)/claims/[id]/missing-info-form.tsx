"use client";
// OWNER: Dev 2. Asks the user for the fields the brand requires, then resubmits.
// Yes/no questions (label ending with "?") get two big buttons instead of a text field.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Candy } from "@/components/ui/brand";

const isYesNo = (label: string) => label.trim().endsWith("?");

export function MissingInfoForm({ claimId, fields, answers }: { claimId: string; fields: string[]; answers: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, answers[f] ?? ""])));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = fields.every((f) => values[f]?.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/claims/${claimId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())) }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) setError(body?.error?.message ?? "Erreur");
    else if (body?.remaining?.length) setError(`Il manque encore : ${body.remaining.join(", ")}`);
    setPending(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 rounded-[28px] border border-warning/50 bg-warning-soft p-5 text-on-warning-soft md:p-6">
      <div className="flex items-start gap-3">
        <Candy kind="claim" size={40} />
        <div>
          <h2 className="text-lg font-bold">La marque a besoin de toi</h2>
          <p className="text-sm opacity-90">
            {fields.length > 1 ? "Ces infos sont" : "Cette info est"} souvent sur l&apos;emballage. Dès que tu réponds, l&apos;agent repart.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f} className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">{f}</span>
            {isYesNo(f) ? (
              <div className="grid grid-cols-2 gap-2">
                {["Oui", "Non"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={values[f] === v}
                    onClick={() => setValues((s) => ({ ...s, [f]: v }))}
                    className={`rounded-[14px] px-4 py-3 text-base font-bold transition ${
                      values[f] === v ? "bg-ink text-surface" : "border border-line-strong/60 bg-raised text-ink"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={values[f]}
                onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
                className="rounded-[14px] border border-line-strong/60 bg-raised px-4 py-3 text-base text-ink outline-none focus:border-ink"
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-on-danger-soft">{error}</p>}
        <button disabled={pending || !complete} className="rounded-[14px] bg-ink px-4 py-3.5 font-bold text-surface transition disabled:opacity-40">
          {pending ? "Envoi…" : "Envoyer et relancer l'agent"}
        </button>
      </form>
    </section>
  );
}
