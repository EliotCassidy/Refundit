"use client";
// OWNER: Dev 2. Subscribe (→ Stripe Checkout) or cancel at period end.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BillingButtons({ subscribed }: { subscribed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string) {
    setPending(true);
    setError(null);
    const res = await fetch(path, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setPending(false);
      return setError(json?.error?.message ?? "Erreur");
    }
    if (json?.url) return window.location.assign(json.url); // Stripe Checkout
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {subscribed ? (
        <button
          onClick={() => confirm("Résilier à la fin de la période en cours ?") && call("/api/billing/cancel")}
          disabled={pending}
          className="self-start text-sm text-muted underline disabled:opacity-50"
        >
          Résilier l&apos;abonnement
        </button>
      ) : (
        <button onClick={() => call("/api/billing/checkout")} disabled={pending} className="rounded-[20px] bg-ink px-4 py-3 font-medium text-surface disabled:opacity-50">
          {pending ? "Redirection…" : "S'abonner"}
        </button>
      )}
      {error && <p className="text-sm text-on-danger-soft">{error}</p>}
    </div>
  );
}
