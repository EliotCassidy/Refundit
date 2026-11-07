// OWNER: Dev 2. One claim, laid out like a bank transaction detail: centered header with the one amount
// that matters, a 3-step progress, grouped detail rows, the agent as a single row, then the follow-up timeline.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { displayLabel } from "@/components/ui/format";
import { group, Row, Section } from "@/components/ui/list";
import { AnimatedMoney, FadeIn } from "@/components/ui/motion";
import { StatusBadge } from "@/components/ui/status";
import { StoreIcon } from "@/components/ui/store-logo";
import { createClient } from "@/lib/shared/supabase/server";
import { ISSUE_LABELS_FR } from "@/lib/shared/types";
import { findStore } from "@/lib/stores";
import { AutoRefresh } from "../auto-refresh";
import { AgentView } from "./agent-view";
import { ClaimActions } from "./claim-actions";
import { MissingInfoForm } from "./missing-info-form";
import { ClaimProgress } from "./progress";
import { Timeline, type TimelineItem } from "./timeline";

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select("*, line_items(product_name, raw_label, total_price_cents), brands(name), receipts(store_name, purchased_at, store:raw_parse->store)")
    .eq("id", id)
    .maybeSingle();
  if (!claim) notFound();

  const [{ data: events }, { data: emails }] = await Promise.all([
    supabase.from("claim_events").select("*").eq("claim_id", id).order("created_at"),
    supabase.from("claim_emails").select("*").eq("claim_id", id).order("received_at"),
  ]);

  const brand = claim.brands?.name ?? "la marque";
  const product = displayLabel(claim.line_items?.product_name || claim.line_items?.raw_label || "Produit");
  const stake = claim.line_items?.total_price_cents ?? 0;
  const live = claim.status === "submitting";
  const refunded = claim.refund_cents != null;
  const hasAgent = Boolean(claim.h_session_id && !claim.h_session_id.startsWith("mock-"));

  const chain = (claim.receipts?.store as { chain?: string | null } | null)?.chain ?? null;
  const store = findStore(chain, claim.receipts?.store_name);
  const printed = claim.receipts?.store_name ? capitalize(claim.receipts.store_name) : null;
  const branch = store && printed && !store.match.test(printed.toLowerCase()) ? printed : null;
  const storeLabel = [store?.name ?? printed, branch].filter(Boolean).join(" · ");

  // Progress: Envoyée → Réponse → Remboursée
  const sent = Boolean(claim.submitted_at) || ["submitted", "waiting_input", "accepted", "refused"].includes(claim.status);
  const firstEmail = emails?.[0]?.received_at ?? null;
  const answered = Boolean(firstEmail) || ["accepted", "refused"].includes(claim.status);
  const acceptedAt = events?.find((e) => e.to_status === "accepted")?.created_at ?? null;
  const done = claim.status === "accepted";
  const stopped = ["cancelled", "refused"].includes(claim.status);
  const steps = [
    { label: "Envoyée", on: sent, date: sent ? day(claim.submitted_at ?? claim.updated_at) : null },
    { label: "Réponse", on: answered, date: firstEmail ? day(firstEmail) : null },
    { label: refunded ? "Remboursée" : claim.status === "refused" ? "Refusée" : "Acceptée", on: done, date: acceptedAt ? day(acceptedAt) : null },
  ];

  // Follow-up timeline.
  const items: TimelineItem[] = [];
  if (sent) {
    items.push({
      key: "sent",
      at: claim.submitted_at ?? claim.created_at,
      kind: "sent",
      title: claim.submission_channel === "email" ? `Réclamation envoyée par e-mail` : `Réclamation envoyée sur le site de ${brand}`,
      meta: claim.dry_run ? "Mode test : formulaire rempli, non envoyé" : null,
      body: claim.complaint_text ?? undefined,
    });
  }
  for (const m of emails ?? []) {
    items.push({ key: m.id, at: m.received_at, kind: "email", title: m.subject ?? `Réponse de ${brand}`, meta: m.from_address, body: m.body_text ?? undefined });
  }
  const answers = Object.entries((claim.user_answers ?? {}) as Record<string, string>);
  const answerText = answers.map(([k, v]) => `${k.trim()}\n→ ${v}`).join("\n\n");
  for (const e of events ?? []) {
    const p = (e.payload ?? {}) as { reply_to_brand?: string };
    if (p.reply_to_brand && answers.length) {
      items.push({ key: e.id, at: e.created_at, kind: "answer", title: "Tu as répondu par e-mail", body: answerText });
    } else if (e.from_status === "waiting_input" && e.to_status === "submitting" && answers.length) {
      items.push({ key: e.id, at: e.created_at, kind: "answer", title: "Tes réponses, transmises par l'agent", body: answerText });
    } else if (e.to_status === "cancelled") {
      items.push({ key: e.id, at: e.created_at, kind: "cancelled", title: "Réclamation arrêtée" });
    } else if (e.to_status === "accepted") {
      items.push({
        key: e.id,
        at: e.created_at,
        kind: "accepted",
        title: refunded ? `Remboursement de ${euros(claim.refund_cents!)} reçu` : "Demande acceptée",
        meta: refunded ? "Virement sécurisé par Stripe" : null,
      });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));

  // Same lists as ClaimActions: only render its slot when it has a button (avoids an empty gap).
  const actionable = (!hasAgent || !live) && ["draft", "submitting", "needs_manual", "waiting_input", "agent_failed"].includes(claim.status);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-7" data-demo-status={claim.status}>
      <Link href="/" className="-ml-1 inline-flex w-fit items-center gap-0.5 text-sm font-medium text-muted transition hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Retour
      </Link>

      {/* Header */}
      <FadeIn className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="grid size-16 place-items-center rounded-full bg-ink text-2xl font-bold text-surface">{brand.charAt(0).toUpperCase()}</span>
          {store && <StoreIcon store={store} size={26} className="absolute -bottom-1 -right-1 rounded-full ring-[3px] ring-white" />}
        </div>
        <p className="mt-4 text-[14px] text-muted">{[brand, ISSUE_LABELS_FR[claim.issue_type]].join(" · ")}</p>
        <h1 className="mt-1 max-w-[460px] text-balance text-[22px] font-semibold leading-tight tracking-tight">{product}</h1>
        <AnimatedMoney cents={claim.refund_cents ?? stake} className={`mt-4 text-[44px] font-semibold leading-none tracking-tight ${refunded ? "text-brand-strong" : ""}`} />
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <StatusBadge status={claim.status} refunded={refunded} dryRun={claim.dry_run} />
          <span>{refunded ? "sur ton compte" : stopped ? "" : "en jeu"}</span>
        </div>
      </FadeIn>

      {!stopped && (
        <FadeIn delay={0.05} className={`${group} px-3 py-5`}>
          <ClaimProgress steps={steps} active={!done && !["agent_failed", "needs_manual"].includes(claim.status)} />
        </FadeIn>
      )}

      {claim.failure_reason && ["needs_manual", "agent_failed"].includes(claim.status) && (
        <FadeIn delay={0.05}>
          <p className="rounded-[18px] bg-warning-soft px-5 py-3.5 text-[14px] text-on-warning-soft">{claim.failure_reason}</p>
        </FadeIn>
      )}

      {claim.status === "waiting_input" && claim.missing_fields.length > 0 && (
        <FadeIn delay={0.08} id="demo-missing">
          <MissingInfoForm claimId={claim.id} fields={claim.missing_fields} answers={(claim.user_answers ?? {}) as Record<string, string>} />
        </FadeIn>
      )}

      {actionable && (
        <FadeIn delay={0.08}>
          <ClaimActions claimId={claim.id} status={claim.status} />
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <Section title="Détails">
          <>
            {storeLabel && (
              <Row label="Magasin">
                <span className="inline-flex items-center gap-2">
                  <StoreIcon store={store} fallbackName={storeLabel} size={20} className="rounded-[6px]" />
                  {storeLabel}
                </span>
              </Row>
            )}
            {claim.receipts?.purchased_at && <Row label="Date d'achat">{longDay(claim.receipts.purchased_at)}</Row>}
            <Row label="Prix payé"><span className="money">{euros(stake)}</span></Row>
            {claim.confirmation_number && <Row label="N° de dossier"><span className="mono text-[13px]">{claim.confirmation_number}</span></Row>}
            {refunded && (
              <Row label="Remboursement">
                <span className="money text-brand-strong">+{euros(claim.refund_cents!)}</span>
                <span className="ml-1.5 font-normal text-muted">via Stripe</span>
              </Row>
            )}
          </>
          {hasAgent && (
            <div>
              <AgentView claimId={claim.id} live={live} actions={live ? <ClaimActions claimId={claim.id} status={claim.status} /> : undefined} />
            </div>
          )}
        </Section>
      </FadeIn>

      <FadeIn delay={0.14} id="demo-suivi">
        <Section title="Suivi">
          <Timeline items={items} waitingFor={sent && !answered && !stopped ? brand : null} />
        </Section>
      </FadeIn>

      <AutoRefresh syncClaimIds={live ? [claim.id] : []} />
    </div>
  );
}
