// OWNER: Dev 2. Subscription page in the app's grouped-list style: usage ring header, the two offers as rows,
// upgrade button or cancel row, FAQ.
import { Check, Infinity as InfinityIcon, ScanLine } from "lucide-react";
import { StripeBadge } from "@/components/ui/brand";
import { PageHeader, Section } from "@/components/ui/list";
import { FadeIn } from "@/components/ui/motion";
import { FREE_SCANS_PER_MONTH, getScanQuota } from "@/lib/billing";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { CancelRow, UpgradeButton } from "./billing-buttons";
import { Faq, UsageRing } from "./billing-visuals";

const FAQ = [
  { q: "Puis-je résilier quand je veux ?", a: "Oui. La résiliation prend effet à la fin du mois en cours : tu gardes les scans illimités jusque-là, sans frais." },
  { q: "Que se passe-t-il quand j'atteins la limite gratuite ?", a: "Tes réclamations en cours continuent normalement. Tu pourras scanner un nouveau ticket le mois prochain, ou tout de suite avec Illimité." },
  { q: "Mes données de paiement sont-elles en sécurité ?", a: "Le paiement est géré par Stripe : Refundit ne voit ni ne stocke jamais ton numéro de carte." },
];

function nextReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function Offer({ icon, name, detail, price, current }: { icon: React.ReactNode; name: string; detail: string; price: string; current: boolean }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3.5 px-5 py-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${current ? "bg-ink text-surface" : "bg-sunken text-ink"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-medium">
          {name}
          {current && <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-on-brand-soft"><Check className="size-3" strokeWidth={2.5} aria-hidden />Ton offre</span>}
        </span>
        <span className="block text-[13px] text-muted">{detail}</span>
      </span>
      <span className="money shrink-0 text-[15px]">{price}</span>
    </div>
  );
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
  const endShort = profile?.subscription_period_end
    ? new Date(profile.subscription_period_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;
  const atLimit = !unlimited && !exempt && !quota.canScan;
  const scans = `${quota.used} ticket${quota.used > 1 ? "s" : ""} scanné${quota.used > 1 ? "s" : ""} ce mois-ci`;

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-7">
      <FadeIn>
        <PageHeader
          title={unlimited ? "Refundit Illimité" : "Offre gratuite"}
          subtitle={
            unlimited
              ? <>{scans}{end && <><br />Prochaine échéance le {end}</>}</>
              : exempt
                ? <>Compte de test : scans illimités<br />{scans}</>
                : atLimit
                  ? <>Limite gratuite atteinte<br />Ton scan gratuit revient le {nextReset()}</>
                  : <>{quota.remaining} scan gratuit restant ce mois-ci</>
          }
        >
          <div className="mb-4">
            <UsageRing used={quota.used} limit={FREE_SCANS_PER_MONTH} unlimited={unlimited || exempt} />
          </div>
        </PageHeader>
      </FadeIn>

      {status === "success" && (
        <FadeIn><p className="rounded-[18px] bg-brand-soft px-5 py-3.5 text-center text-[14px] font-medium text-on-brand-soft">Bienvenue dans Refundit Illimité !</p></FadeIn>
      )}
      {status === "error" && (
        <FadeIn><p className="rounded-[18px] bg-danger-soft px-5 py-3.5 text-center text-[14px] text-on-danger-soft">Le paiement n&apos;a pas pu être vérifié.</p></FadeIn>
      )}

      <FadeIn delay={0.05} className="flex flex-col gap-4">
        <Section title="Offres">
          <Offer icon={<ScanLine className="size-[18px]" aria-hidden />} name="Gratuit" detail={`${FREE_SCANS_PER_MONTH} scan de ticket par mois`} price="0 €" current={!unlimited} />
          <Offer icon={<InfinityIcon className="size-[18px]" aria-hidden />} name="Illimité" detail="Scans illimités · sans engagement" price="9,99 €" current={unlimited} />
        </Section>
        {!unlimited && (
          <div className="flex flex-col items-center gap-3">
            <UpgradeButton />
            <StripeBadge />
            <p className="text-center text-xs text-muted">Mode test : carte 4242 4242 4242 4242, date future, n&apos;importe quel code.</p>
          </div>
        )}
      </FadeIn>

      <FadeIn delay={0.1}>
        <Section title="Toutes les offres incluent">
          {["Réclamations envoyées par l'agent", "Suivi des réponses des marques", "Remboursements versés via Stripe"].map((f) => (
            <div key={f} className="flex min-h-[48px] items-center gap-3 px-5 py-2.5 text-[15px]">
              <Check className="size-4 shrink-0 text-brand-strong" strokeWidth={2.5} aria-hidden />
              {f}
            </div>
          ))}
        </Section>
      </FadeIn>

      {unlimited && (
        <FadeIn delay={0.12}>
          <Section title="Gérer" footer={<StripeBadge />}>
            <CancelRow until={endShort} />
          </Section>
        </FadeIn>
      )}

      <FadeIn delay={0.15}>
        <Section title="Questions fréquentes">
          <Faq items={FAQ} />
        </Section>
      </FadeIn>
    </div>
  );
}
