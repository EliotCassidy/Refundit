"use client";
// OWNER: Dev 2. Cancel (user control) and Retry buttons.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaimStatus } from "@/lib/shared/types";

const CANCELLABLE: ClaimStatus[] = ["draft", "submitting", "needs_manual"];
const RETRYABLE: ClaimStatus[] = ["draft", "agent_failed", "needs_manual"];

export function ClaimActions({ claimId, status }: { claimId: string; status: ClaimStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "cancel" | "submit") {
    if (action === "cancel" && !confirm("Arrêter l'agent et annuler cette réclamation ?")) return;
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
      <div className="flex gap-2">
        {RETRYABLE.includes(status) && (
          <button
            onClick={() => call("submit")}
            disabled={pending !== null}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-2 font-medium disabled:opacity-50"
          >
            {pending === "submit" ? "Envoi…" : status === "draft" ? "Envoyer" : "Réessayer"}
          </button>
        )}
        {CANCELLABLE.includes(status) && (
          <button
            onClick={() => call("cancel")}
            disabled={pending !== null}
            className="flex-1 rounded-xl border border-red-300 px-4 py-2 font-medium text-red-700 disabled:opacity-50"
          >
            {pending === "cancel" ? "Arrêt…" : status === "submitting" ? "Arrêter l'agent" : "Annuler"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
