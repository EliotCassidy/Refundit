// Main dashboard (home), banking-app style: balance + quick actions, to-dos, activity feed.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessageCircleQuestion } from "lucide-react";
import { ReceiptScan } from "@/components/ui/receipt-scan";
import { displayLabel } from "@/components/ui/format";
import { FadeIn } from "@/components/ui/motion";
import { STATUS_GROUP } from "@/components/ui/status";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { AutoRefresh } from "./claims/auto-refresh";
import { InboxPoller } from "./claims/inbox-poller";
import { ActivityFeed, type FeedClaim } from "./dashboard/activity-feed";
import { DashboardHero } from "./dashboard/hero";

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user!.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data } = await supabase
    .from("claims")
    .select("id, status, issue_type, missing_fields, refund_cents, updated_at, line_items(product_name, raw_label, total_price_cents), brands(name)")
    .neq("status", "draft")
    .order("updated_at", { ascending: false });

  const claims = (data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    issueType: c.issue_type,
    missingFields: c.missing_fields,
    refundCents: c.refund_cents,
    stakeCents: c.line_items?.total_price_cents ?? 0,
    product: displayLabel(c.line_items?.product_name || c.line_items?.raw_label || "Produit"),
    brand: c.brands?.name ?? null,
    updatedAt: c.updated_at,
  }));
  const feed: FeedClaim[] = claims;

  const received = claims.reduce((sum, c) => sum + (c.refundCents ?? 0), 0);
  const open = claims.filter((c) => STATUS_GROUP[c.status] === "progress" || STATUS_GROUP[c.status] === "action");
  const pending = open.reduce((sum, c) => sum + c.stakeCents, 0);
  const needsYou = claims.filter((c) => STATUS_GROUP[c.status] === "action");
  const submitting = claims.filter((c) => c.status === "submitting").map((c) => c.id);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <DashboardHero firstName={profile.first_name} received={received} pending={pending} openCount={open.length} needsCount={needsYou.length} />

      {needsYou.length > 0 && (
        <FadeIn delay={0.1}>
          <section id="a-faire" className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="text-lg font-semibold">À faire</h2>
            <ul className="flex flex-col gap-2">
              {needsYou.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/claims/${c.id}`}
                    className="group flex items-center gap-3.5 rounded-[18px] border border-warning/40 bg-warning-soft/60 px-4 py-3.5 transition hover:bg-warning-soft active:scale-[0.99]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning text-[#3a2a0e]"><MessageCircleQuestion className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.product}</span>
                      <span className="block truncate text-sm text-on-warning-soft">
                        {c.status === "waiting_input"
                          ? `${c.brand ?? "La marque"} demande : ${c.missingFields.join(", ")}`
                          : c.status === "needs_manual"
                            ? "Ce site bloque l'agent : à envoyer toi-même"
                            : "L'agent a échoué : relance-le"}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-surface sm:block">
                      {c.status === "waiting_input" ? "Répondre" : "Voir"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-on-warning-soft transition group-hover:translate-x-0.5 sm:hidden" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </FadeIn>
      )}

      {feed.length > 0 ? (
        <FadeIn delay={0.15}>
          <ActivityFeed claims={feed} />
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <section className="flex flex-col items-center gap-4 rounded-[28px] border border-line bg-raised/80 px-6 py-10 text-center backdrop-blur">
            <ReceiptScan size={150} />
            <div>
              <h2 className="text-xl font-bold tracking-tight">Ton premier remboursement commence ici</h2>
              <p className="mt-1.5 text-sm text-muted">Scanne un ticket, coche le produit qui a un problème : notre agent écrit à la marque pour toi.</p>
            </div>
            <Link href="/receipts/new" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-surface transition active:scale-95">
              Scanner mon premier ticket
            </Link>
          </section>
        </FadeIn>
      )}

      <AutoRefresh syncClaimIds={submitting} />
      <InboxPoller />
    </div>
  );
}
