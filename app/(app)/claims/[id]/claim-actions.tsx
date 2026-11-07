"use client";
// OWNER: Dev 2. Stop the agent / cancel, and retry.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaimStatus } from "@/lib/shared/types";

const CANCELLABLE: ClaimStatus[] = ["draft", "submitting", "needs_manual", "waiting_input"];
const RETRYABLE: ClaimStatus[] = ["draft", "agent_failed", "needs_manual"];

export function ClaimActions({ claimId, status }: { claimId: string; status: ClaimStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "cancel" | "submit") {
    const question = status === "submitting" ? "Arrêter l'agent maintenant ? La réclamation ne sera pas envoyée." : "Annuler cette réclamation ?";
    if (action === "cancel" && !confirm(question)) return;
    setPending(action);
    setError(null);
    const res = await fetch(`/api/claims/${claimId}/${action}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Erreur");
    }
    setPending(null);
    router.refresh();
  }

  if (!CANCELLABLE.includes(status) && !RETRYABLE.includes(status)) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {RETRYABLE.includes(status) && (
          <button
            onClick={() => call("submit")}
            disabled={pending !== null}
            className="flex-1 rounded-[14px] bg-ink px-4 py-3 text-sm font-bold text-surface transition hover:opacity-90 disabled:opacity-50"
          >
            {pending === "submit" ? "Envoi…" : status === "draft" ? "Envoyer à la marque" : "Relancer l'agent"}
          </button>
        )}
        {CANCELLABLE.includes(status) && (
          <button
            onClick={() => call("cancel")}
            disabled={pending !== null}
            className={`flex-1 rounded-[14px] px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
              status === "submitting"
                ? "bg-danger text-white hover:opacity-90"
                : "border border-line-strong/60 text-on-danger-soft hover:bg-danger-soft"
            }`}
          >
            {pending === "cancel" ? "Arrêt…" : status === "submitting" ? "■ Arrêter l'agent" : "Annuler la réclamation"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-on-danger-soft">{error}</p>}
    </div>
  );
}
