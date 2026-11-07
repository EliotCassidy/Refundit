// OWNER: Dev 2. One claim: progress, live agent (with Stop), refund, conversation with the brand.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Money, StripeBadge } from "@/components/ui/brand";
import { displayLabel } from "@/components/ui/format";
import { STATUS_LABEL, StatusBadge } from "@/components/ui/status";
import { createClient } from "@/lib/shared/supabase/server";
import { ISSUE_LABELS_FR } from "@/lib/shared/types";
import { AutoRefresh } from "../auto-refresh";
import { AgentView } from "./agent-view";
import { ClaimActions } from "./claim-actions";
import { Conversation, type Message } from "./conversation";
import { MissingInfoForm } from "./missing-info-form";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select("*, line_items(product_name, raw_label, total_price_cents), brands(name), receipts(store_name, purchased_at)")
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
  const hasAgent = Boolean(claim.h_session_id && !claim.h_session_id.startsWith("mock-"));

  // Progress: Envoyée → Réponse → Remboursée
  const sent = Boolean(claim.submitted_at) || ["submitted", "waiting_input", "accepted", "refused"].includes(claim.status);
  const answered = (emails ?? []).length > 0 || ["accepted", "refused"].includes(claim.status);
  const done = claim.status === "accepted";
  const steps = [
    { label: "Envoyée", on: sent, sub: claim.submitted_at ? fmt(claim.submitted_at) : live ? "L'agent remplit le formulaire" : null },
    { label: `Réponse de ${brand}`, on: answered, sub: answered ? (claim.status === "refused" ? "Refus" : "Reçue") : sent ? "En attente" : null },
    { label: claim.refund_cents != null ? "Remboursée" : "Acceptée", on: done, sub: claim.refund_cents != null ? "Virement reçu" : null },
  ];

  // Conversation: our complaint, brand emails, our replies.
  const messages: Message[] = [];
  if (claim.complaint_text && sent) {
    messages.push({
      key: "complaint",
      at: claim.submitted_at ?? claim.created_at,
      from: "me",
      title: claim.submission_channel === "email" ? `E-mail envoyé à ${brand}` : `Formulaire de contact de ${brand}`,
      body: claim.complaint_text,
      tag: claim.dry_run ? "Test : non envoyé" : null,
    });
  }
  for (const m of emails ?? []) {
    messages.push({
      key: m.id,
      at: m.received_at,
      from: "brand",
      title: m.subject ?? `Réponse de ${brand}`,
      body: m.body_text ?? "",
      sender: m.from_address,
      tag: m.classification_reason,
    });
  }
  const answers = Object.entries((claim.user_answers ?? {}) as Record<string, string>);
  for (const e of events ?? []) {
    const p = (e.payload ?? {}) as { reply_to_brand?: string };
    if (p.reply_to_brand && answers.length) {
      messages.push({ key: e.id, at: e.created_at, from: "me", title: "Ta réponse par e-mail", body: answers.map(([k, v]) => `${k} : ${v}`).join("\n"), tag: null });
    } else if (e.from_status === "waiting_input" && e.to_status === "submitting" && answers.length) {
      messages.push({ key: e.id, at: e.created_at, from: "me", title: "Infos transmises par l'agent", body: answers.map(([k, v]) => `${k} : ${v}`).join("\n"), tag: null });
    }
  }
  messages.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Tableau de bord
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-5 rounded-[20px] border border-line bg-raised p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{[brand, claim.receipts?.store_name].filter(Boolean).join(" · ")}</p>
            <h1 className="mt-1.5 text-[24px] font-bold tracking-tight md:text-[28px]">{product}</h1>
            <p className="mt-1 text-sm text-muted">{ISSUE_LABELS_FR[claim.issue_type]}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={claim.status} refunded={claim.refund_cents != null} dryRun={claim.dry_run} />
            <Money cents={claim.refund_cents ?? stake} className={`text-[22px] ${claim.refund_cents != null ? "text-brand-strong" : ""}`} />
          </div>
        </div>

        <ol className="grid grid-cols-3 gap-2">
          {steps.map((s, i) => (
            <li key={s.label} className="flex flex-col gap-1.5">
              <span className={`h-1 rounded-full ${s.on ? (i === 2 ? "bg-brand" : "bg-ink") : "bg-line"}`} />
              <span className={`text-xs font-semibold md:text-sm ${s.on ? "" : "text-muted"}`}>{s.label}</span>
              {s.sub && <span className="text-[11px] text-muted md:text-xs">{s.sub}</span>}
            </li>
          ))}
        </ol>

        {claim.confirmation_number && (
          <p className="text-sm text-muted">N° de dossier <span className="mono text-ink">{claim.confirmation_number}</span></p>
        )}
        {claim.failure_reason && ["needs_manual", "agent_failed"].includes(claim.status) && (
          <p className="rounded-[14px] bg-warning-soft p-3 text-sm text-on-warning-soft">{claim.failure_reason}</p>
        )}
      </header>

      {/* Refund */}
      {claim.refund_cents != null && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-brand/30 bg-brand-soft p-5 md:p-6">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-on-brand-soft">Remboursement reçu</span>
            <Money cents={claim.refund_cents} className="text-[36px] leading-none text-brand-strong" />
            {claim.stripe_payment_id && <span className="mono text-xs text-on-brand-soft/70">{claim.stripe_payment_id}</span>}
          </div>
          <StripeBadge className="rounded-full bg-raised px-3 py-1.5" />
        </section>
      )}

      {/* What the user must do */}
      {claim.status === "waiting_input" && claim.missing_fields.length > 0 && (
        <MissingInfoForm claimId={claim.id} fields={claim.missing_fields} answers={(claim.user_answers ?? {}) as Record<string, string>} />
      )}

      {/* Agent */}
      {hasAgent ? (
        <AgentView claimId={claim.id} live={live} actions={<ClaimActions claimId={claim.id} status={claim.status} />} />
      ) : (
        <ClaimActions claimId={claim.id} status={claim.status} />
      )}

      {/* Conversation */}
      <Conversation messages={messages} brand={brand} waiting={sent && !answered} />

      {/* Raw history */}
      <details className="rounded-[16px] border border-line bg-raised px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-muted">Historique détaillé</summary>
        <ol className="mt-3 flex flex-col gap-2 border-l border-line pl-4">
          <li><span className="text-muted">{fmt(claim.created_at)}</span> · Demande créée</li>
          {(events ?? [])
            .filter((e) => e.type === "status_change" && e.to_status)
            .map((e) => (
              <li key={e.id}><span className="text-muted">{fmt(e.created_at)}</span> · {STATUS_LABEL[e.to_status!]}</li>
            ))}
        </ol>
      </details>

      <AutoRefresh syncClaimIds={live ? [claim.id] : []} />
    </div>
  );
}
