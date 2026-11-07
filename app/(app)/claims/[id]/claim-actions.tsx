"use client";
// OWNER: Dev 2. Stop the agent / cancel, and retry. Loading states + toasts.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ClaimStatus } from "@/lib/shared/types";

const CANCELLABLE: ClaimStatus[] = ["draft", "submitting", "needs_manual", "waiting_input"];
const RETRYABLE: ClaimStatus[] = ["draft", "agent_failed", "needs_manual"];

export function ClaimActions({ claimId, status }: { claimId: string; status: ClaimStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "submit" | null>(null);

  async function call(action: "cancel" | "submit") {
    const question = status === "submitting" ? "Arrêter l'agent maintenant ? La réclamation ne sera pas envoyée." : "Annuler cette réclamation ?";
    if (action === "cancel" && !confirm(question)) return;
    setPending(action);
    const res = await fetch(`/api/claims/${claimId}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok) {
      toast.error(body?.error?.message ?? "Une erreur est survenue");
      return;
    }
    if (action === "cancel") toast.success(status === "submitting" ? "Agent arrêté" : "Réclamation annulée");
    else toast.success("L'agent est reparti", { description: "Tu peux le suivre en direct ici." });
    router.refresh();
  }

  if (!CANCELLABLE.includes(status) && !RETRYABLE.includes(status)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {RETRYABLE.includes(status) && (
        <Button
          variant="dark"
          size="lg"
          className="flex-1"
          loading={pending === "submit"}
          disabled={pending !== null}
          icon={status === "draft" ? <Send className="size-4" /> : <RotateCcw className="size-4" />}
          onClick={() => call("submit")}
        >
          {status === "draft" ? "Envoyer à la marque" : "Relancer l'agent"}
        </Button>
      )}
      {CANCELLABLE.includes(status) && (
        <Button
          variant={status === "submitting" ? "danger" : "danger-soft"}
          size="lg"
          className="flex-1"
          loading={pending === "cancel"}
          disabled={pending !== null}
          icon={status === "submitting" ? <Square className="size-4 fill-current" /> : <X className="size-4" />}
          onClick={() => call("cancel")}
        >
          {status === "submitting" ? "Arrêter l'agent" : "Annuler la réclamation"}
        </Button>
      )}
    </div>
  );
}
