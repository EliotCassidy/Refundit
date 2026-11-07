// OWNER: Dev 2. "Mon abonnement": free quota or Refundit Illimité (€9.99/month).
import { FREE_SCANS_PER_MONTH, getScanQuota, PLAN } from "@/lib/billing";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { BillingButtons } from "./billing-buttons";

const price = (PLAN.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await getUser();
  const { status } = await searchParams;
  const [quota, { data: profile }] = await Promise.all([
    getScanQuota(user!.id),
    createAdminClient().from("profiles").select("subscription_status, subscription_period_end").eq("id", user!.id).single(),
  ]);
  const end = profile?.subscription_period_end
    ? new Date(profile.subscription_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Mon abonnement</h1>
      {status === "success" && <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-800 dark:text-green-400">Bienvenue dans Refundit Illimité !</p>}
      {status === "error" && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-400">Le paiement n&apos;a pas pu être vérifié.</p>}

      {quota.plan === "unlimited" ? (
        <section className="flex flex-col gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <h2 className="font-semibold">{PLAN.name} · {price}/mois</h2>
          <p className="text-sm">Scans illimités. {quota.used} ticket(s) scanné(s) ce mois-ci.</p>
          {end && <p className="text-sm text-neutral-500">Prochaine échéance (ou fin, si résilié) : {end}</p>}
          <BillingButtons subscribed />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-xl bg-neutral-500/10 p-4">
            <h2 className="font-semibold">Offre gratuite</h2>
            <p className="text-sm">
              {quota.used} / {FREE_SCANS_PER_MONTH} scan utilisé ce mois-ci.
              {!quota.canScan && " Vous avez atteint la limite gratuite."}
            </p>
          </section>
          <section className="flex flex-col gap-3 rounded-xl border border-foreground p-4">
            <h2 className="text-lg font-semibold">{PLAN.name}</h2>
            <p className="text-3xl font-bold">{price}<span className="text-base font-normal text-neutral-500"> / mois</span></p>
            <ul className="list-inside list-disc text-sm text-neutral-500">
              <li>Scans de tickets illimités</li>
              <li>Réclamations envoyées par l&apos;agent pour chaque produit</li>
              <li>Sans engagement, résiliable à tout moment</li>
            </ul>
            <BillingButtons subscribed={false} />
            <p className="text-xs text-neutral-500">Paiement sécurisé par Stripe (mode test : carte 4242 4242 4242 4242).</p>
          </section>
        </>
      )}
    </div>
  );
}
