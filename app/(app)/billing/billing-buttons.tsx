"use client";
// OWNER: Dev 2. Subscribe (→ Stripe Checkout) or cancel at period end.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BillingButtons({ subscribed }: { subscribed: boolean }) {
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

  return subscribed ? (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      loading={pending}
      onClick={() => confirm("Résilier à la fin de la période en cours ?") && call("/api/billing/cancel")}
    >
      Résilier l&apos;abonnement
    </Button>
  ) : (
    <Button variant="primary" size="lg" block loading={pending} icon={<Sparkles className="size-4" />} onClick={() => call("/api/billing/checkout")}>
      {pending ? "Ouverture du paiement…" : "Passer à Illimité"}
    </Button>
  );
}
