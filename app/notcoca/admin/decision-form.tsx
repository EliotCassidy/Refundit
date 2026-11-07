"use client";
// OWNER: Dev 2. NotCoca admin: refund (+ compensation) or reject a request.
import { useState } from "react";
import { useRouter } from "next/navigation";

const toCents = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "0").replace(",", ".")) * 100);

export function DecisionForm({ requestId, demoTarget = false }: { requestId: string; demoTarget?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: object) {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/notcoca/admin/requests/${requestId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) return setError(json?.error?.message ?? "Erreur");
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4">
      <form
        id={demoTarget ? "demo-refund" : undefined}
        action={(f) => send({ kind: "refund", refundCents: toCents(f.get("refund")), compensationCents: toCents(f.get("compensation")) })}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col text-sm">Remboursement (€)
          <input name="refund" defaultValue="2,45" inputMode="decimal" className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="flex flex-col text-sm">Dédommagement (€)
          <input name="compensation" defaultValue="5" inputMode="decimal" className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5" />
        </label>
        <button disabled={pending} className="rounded-full bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? "…" : "Rembourser"}
        </button>
      </form>
      <form action={(f) => send({ kind: "reject", reason: String(f.get("reason") ?? "") })} className="flex flex-wrap items-end gap-3">
        <input name="reason" required minLength={3} placeholder="Motif du refus" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
        <button disabled={pending} className="rounded-full border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50">Refuser</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
