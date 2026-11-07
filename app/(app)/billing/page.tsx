// OWNER: Dev 2. Subscription page: usage this month, plan comparison (Gratuit / Illimité), FAQ.
import { Check, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { glass } from "@/components/ui/aurora";
import { StripeBadge } from "@/components/ui/brand";
import { FadeIn } from "@/components/ui/motion";
import { FREE_SCANS_PER_MONTH, getScanQuota, PLAN } from "@/lib/billing";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { BillingButtons } from "./billing-buttons";
import { Faq, GlowBorder, Price, UsageRing } from "./billing-visuals";

const FREE_FEATURES = [`${FREE_SCANS_PER_MONTH} scan de ticket par mois`, "Réclamations envoyées par l'agent", "Suivi des réponses des marques"];
const PRO_FEATURES = ["Scans de tickets illimités", "Réclamations envoyées par l'agent", "Suivi des réponses des marques", "Sans engagement, résiliable à tout moment"];

const FAQ = [
  { q: "Puis-je résilier quand je veux ?", a: "Oui. La résiliation prend effet à la fin du mois en cours : tu gardes les scans illimités jusque-là, sans frais." },
  { q: "Que se passe-t-il quand j'atteins la limite gratuite ?", a: "Tes réclamations en cours continuent normalement. Tu pourras scanner un nouveau ticket le mois prochain, ou tout de suite avec Illimité." },
  { q: "Mes données de paiement sont-elles en sécurité ?", a: "Le paiement est géré par Stripe : Refundit ne voit ni ne stocke jamais ton numéro de carte." },
];

function nextReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await getUser();
  const { status } = await searchParams;
  const [quota, { data: profile }] = await Promise.all([
    getScanQuota(user!.id),
    createAdminClient().from("profiles").select("subscription_status, subscription_period_end").eq("id", user!.id).single(),
  ]);
  const exempt = (process.env.SCAN_QUOTA_EXEMPT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes((user!.email ?? "").toLowerCase());
  const unlimited = quota.plan === "unlimited";
  const end = profile?.subscription_period_end
    ? new Date(profile.subscription_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const atLimit = !unlimited && !exempt && !quota.canScan;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
      <header className="text-center">
        <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Abonnement</h1>
        <p className="mt-1.5 text-[15px] text-muted">Scanne autant de tickets que tu veux, on s&apos;occupe du reste.</p>
      </header>

      {status === "success" && (
        <FadeIn><p className="rounded-[14px] border border-brand/30 bg-brand-soft px-4 py-3 text-center text-sm font-medium text-on-brand-soft">Bienvenue dans Refundit Illimité !</p></FadeIn>
      )}
      {status === "error" && (
        <FadeIn><p className="rounded-[14px] bg-danger-soft px-4 py-3 text-center text-sm text-on-danger-soft">Le paiement n&apos;a pas pu être vérifié.</p></FadeIn>
      )}

      {/* Usage */}
      <FadeIn>
        <section className={`${glass} flex items-center gap-5 p-5 md:p-6`}>
          <UsageRing used={quota.used} limit={FREE_SCANS_PER_MONTH} unlimited={unlimited || exempt} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Ce mois-ci</p>
            <p className="text-lg font-semibold">
              {unlimited
                ? `${quota.used} ticket${quota.used > 1 ? "s" : ""} scanné${quota.used > 1 ? "s" : ""}`
                : exempt
                  ? "Compte de test : scans illimités"
                  : atLimit
                    ? "Limite gratuite atteinte"
                    : `${quota.remaining} scan gratuit restant`}
            </p>
            <p className="text-sm text-muted">
              {unlimited
                ? end ? `Prochaine échéance le ${end}` : "Scans illimités"
                : `Ton scan gratuit revient le ${nextReset()}.`}
            </p>
          </div>
        </section>
      </FadeIn>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-2">
        <FadeIn delay={0.05}>
          <section className={`${glass} flex h-full flex-col gap-5 p-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gratuit</h2>
              {!unlimited && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-surface">Ton offre</span>}
            </div>
            <p><span className="money text-[40px] leading-none">0 €</span><span className="text-sm text-muted"> / mois</span></p>
            <ul className="flex flex-1 flex-col gap-2.5 text-sm">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5"><Check className="size-4 text-muted" aria-hidden /> {f}</li>
              ))}
            </ul>
          </section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlowBorder>
            <section className="flex h-full flex-col gap-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><InfinityIcon className="size-5 text-brand-strong" aria-hidden /> Illimité</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-on-brand">
                  {unlimited ? <><Check className="size-3" aria-hidden /> Ton offre</> : <><Sparkles className="size-3" aria-hidden /> Recommandé</>}
                </span>
              </div>
              <p className="flex items-baseline gap-1"><Price cents={PLAN.amountCents} /><span className="text-sm text-muted">/ mois</span></p>
              <ul className="flex flex-1 flex-col gap-2.5 text-sm">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="grid size-5 place-items-center rounded-full bg-brand-soft text-brand-strong"><Check className="size-3" strokeWidth={3} aria-hidden /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <BillingButtons subscribed={unlimited} />
              <StripeBadge className="justify-center" />
            </section>
          </GlowBorder>
        </FadeIn>
      </div>

      {!unlimited && <p className="-mt-4 text-center text-xs text-muted">Mode test Stripe : carte 4242 4242 4242 4242, date future, n&apos;importe quel code.</p>}

      {/* FAQ */}
      <FadeIn delay={0.15}>
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Questions fréquentes</h2>
          <Faq items={FAQ} />
        </section>
      </FadeIn>
    </div>
  );
}
