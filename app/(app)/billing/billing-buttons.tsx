"use client";
// OWNER: Dev 2. Subscribe (→ Stripe Checkout) or cancel at period end.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonRow } from "@/components/ui/list";

function useBilling() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function call(path: string) {
    setPending(true);
    const res = await fetch(path, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setPending(false);
      toast.error(json?.error?.message ?? "Une erreur est survenue");
      return;
    }
    if (json?.url) return window.location.assign(json.url); // Stripe Checkout (keeps the spinner until redirect)
    setPending(false);
    toast.success("Abonnement résilié", { description: "Il reste actif jusqu'à la fin de la période." });
    router.refresh();
  }
  return { pending, call };
}

export function UpgradeButton() {
  const { pending, call } = useBilling();
  return (
    <Button variant="dark" size="lg" block loading={pending} onClick={() => call("/api/billing/checkout")}>
      {pending ? "Ouverture du paiement…" : "Passer à Refundit+ · 9,99 € / mois"}
    </Button>
  );
}

export function CancelRow({ until }: { until: string | null }) {
  const { pending, call } = useBilling();
  return (
    <ButtonRow
      tone="danger"
      chevron={false}
      icon={<XCircle className="size-[18px]" aria-hidden />}
      label={pending ? "Résiliation…" : "Résilier l'abonnement"}
      description={until ? `Refundit+ reste actif jusqu'au ${until}` : "Sans frais, à la fin de la période"}
      disabled={pending}
      onClick={() => confirm("Résilier à la fin de la période en cours ?") && call("/api/billing/cancel")}
    />
  );
}
