// Main dashboard (home), banking-app style: balance + quick actions, to-dos, activity feed.
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { ReceiptScan } from "@/components/ui/receipt-scan";
import { displayLabel } from "@/components/ui/format";
import { group, NavRow, Section } from "@/components/ui/list";
import { FadeIn } from "@/components/ui/motion";
import { STATUS_GROUP } from "@/components/ui/status";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { AutoRefresh } from "./claims/auto-refresh";
import { InboxPoller } from "./claims/inbox-poller";
import { ActivityFeed, type FeedClaim } from "./dashboard/activity-feed";
import { DashboardHero } from "./dashboard/hero";
import { IbanReminder } from "./dashboard/iban-reminder";

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name, iban").eq("id", user!.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data } = await supabase
    .from("claims")
    .select("id, status, issue_type, missing_fields, refund_cents, updated_at, receipt_id, line_items(product_name, raw_label, total_price_cents), brands(name), receipts(store_name, purchased_at, created_at, store:raw_parse->store)")
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
    receiptId: c.receipt_id,
    storeName: c.receipts?.store_name ?? null,
    storeChain: (c.receipts?.store as { chain?: string | null } | null)?.chain ?? null,
    purchasedAt: c.receipts?.purchased_at ?? null,
    scannedAt: c.receipts?.created_at ?? c.updated_at,
  }));
  const feed: FeedClaim[] = claims;

  const received = claims.reduce((sum, c) => sum + (c.refundCents ?? 0), 0);
  // Pending = money still to come: every claim not refunded yet and not stopped (incl. accepted without a payment yet).
  const open = claims.filter((c) => c.refundCents == null && STATUS_GROUP[c.status] !== "stopped");
  const pending = open.reduce((sum, c) => sum + c.stakeCents, 0);
  const needsYou = claims.filter((c) => STATUS_GROUP[c.status] === "action");
  const submitting = claims.filter((c) => c.status === "submitting").map((c) => c.id);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <DashboardHero firstName={profile.first_name} received={received} pending={pending} openCount={open.length} needsCount={needsYou.length} hasIban={Boolean(profile.iban)} />

      {!profile.iban && (
        <FadeIn delay={0.05}>
          <IbanReminder />
        </FadeIn>
      )}

      {needsYou.length > 0 && (
        <FadeIn delay={0.1}>
          <div id="a-faire" className="scroll-mt-20">
            <Section title="À faire">
              {needsYou.map((c) => (
                <NavRow
                  key={c.id}
                  href={`/claims/${c.id}`}
                  icon={<MessageCircleQuestion className="size-[18px] text-on-warning-soft" aria-hidden />}
                  label={c.product}
                  description={
                    c.status === "waiting_input"
                      ? `${c.brand ?? "La marque"} demande : ${c.missingFields.join(", ")}`
                      : c.status === "needs_manual"
                        ? "Ce site bloque l'agent : à envoyer toi-même"
                        : "L'agent a échoué : relance-le"
                  }
                  value={<span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-on-warning-soft">{c.status === "waiting_input" ? "Répondre" : "Voir"}</span>}
                />
              ))}
            </Section>
          </div>
        </FadeIn>
      )}

      {feed.length > 0 ? (
        <FadeIn delay={0.15}>
          <ActivityFeed claims={feed} />
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <section className={`${group} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
            <ReceiptScan size={150} />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Ton premier remboursement commence ici</h2>
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
