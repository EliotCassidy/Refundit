// OWNER: Dev 2. One claim: compact header + progress, compact agent (Stop), refund, conversation.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Money, StripeBadge } from "@/components/ui/brand";
import { displayLabel } from "@/components/ui/format";
import { FadeIn } from "@/components/ui/motion";
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
const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

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
    { label: "Envoyée", on: sent },
    { label: "Réponse", on: answered },
    { label: claim.refund_cents != null ? "Remboursée" : "Acceptée", on: done },
  ];

  // Conversation: our complaint, system events, brand emails, our replies.
  const messages: Message[] = [];
  if (claim.complaint_text && sent) {
    messages.push({
      key: "sent",
      at: claim.submitted_at ?? claim.created_at,
      from: "system",
      title: claim.submission_channel === "email" ? "Envoyée par e-mail" : "Envoyée via le formulaire de la marque",
      body: "",
      tag: null,
    });
    messages.push({
      key: "complaint",
      at: claim.submitted_at ?? claim.created_at,
      from: "me",
      title: "Ta réclamation",
      body: claim.complaint_text,
      tag: claim.dry_run ? "Test : non envoyée" : claim.confirmation_number ? `Dossier ${claim.confirmation_number}` : null,
    });
  }
  for (const m of emails ?? []) {
    messages.push({ key: m.id, at: m.received_at, from: "brand", title: m.subject ?? `Réponse de ${brand}`, body: m.body_text ?? "", sender: m.from_address, tag: m.classification_reason });
  }
  const answers = Object.entries((claim.user_answers ?? {}) as Record<string, string>);
  for (const e of events ?? []) {
    const p = (e.payload ?? {}) as { reply_to_brand?: string };
    if (p.reply_to_brand && answers.length) {
      messages.push({ key: e.id, at: e.created_at, from: "me", title: "Ta réponse par e-mail", body: answers.map(([k, v]) => `${k} : ${v}`).join("\n"), tag: null });
    } else if (e.from_status === "waiting_input" && e.to_status === "submitting" && answers.length) {
      messages.push({ key: e.id, at: e.created_at, from: "me", title: "Infos transmises par l'agent", body: answers.map(([k, v]) => `${k} : ${v}`).join("\n"), tag: null });
    } else if (e.to_status === "cancelled") {
      messages.push({ key: e.id, at: e.created_at, from: "system", title: "Réclamation arrêtée", body: "", tag: null });
    } else if (e.to_status === "accepted") {
      messages.push({
        key: e.id,
        at: e.created_at,
        from: "system",
        title: claim.refund_cents != null ? `Remboursement reçu : ${euros(claim.refund_cents)}` : "Demande acceptée",
        body: "",
        tag: null,
        tone: "success",
      });
    }
  }
  messages.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Tableau de bord
      </Link>

      {/* Header */}
      <FadeIn>
        <header className="flex flex-col gap-4 rounded-[20px] border border-line bg-raised/90 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-muted">{[brand, ISSUE_LABELS_FR[claim.issue_type]].join(" · ")}</p>
              <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight md:text-[26px]">{product}</h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Money cents={claim.refund_cents ?? stake} className={`text-[20px] ${claim.refund_cents != null ? "text-brand-strong" : ""}`} />
              <StatusBadge status={claim.status} refunded={claim.refund_cents != null} dryRun={claim.dry_run} />
            </div>
          </div>
          <ol className="grid grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex flex-col gap-1.5">
                <span className="h-1 overflow-hidden rounded-full bg-line">
                  <span className={`block h-full rounded-full transition-all duration-700 ${s.on ? "w-full" : "w-0"} ${i === 2 ? "bg-brand" : "bg-ink"}`} />
                </span>
                <span className={`text-xs font-medium ${s.on ? "text-ink" : "text-muted"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
          {claim.failure_reason && ["needs_manual", "agent_failed"].includes(claim.status) && (
            <p className="rounded-[12px] bg-warning-soft px-3 py-2 text-sm text-on-warning-soft">{claim.failure_reason}</p>
          )}
        </header>
      </FadeIn>

      {/* Refund */}
      {claim.refund_cents != null && (
        <FadeIn delay={0.05}>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-brand/30 bg-brand-soft px-5 py-4">
            <div>
              <p className="text-[13px] font-medium text-on-brand-soft">Remboursement reçu</p>
              <Money cents={claim.refund_cents} className="text-[28px] leading-tight text-brand-strong" />
            </div>
            <StripeBadge className="rounded-full bg-raised px-3 py-1.5" />
          </section>
        </FadeIn>
      )}

      {/* What the user must do */}
      {claim.status === "waiting_input" && claim.missing_fields.length > 0 && (
        <FadeIn delay={0.05}>
          <MissingInfoForm claimId={claim.id} fields={claim.missing_fields} answers={(claim.user_answers ?? {}) as Record<string, string>} />
        </FadeIn>
      )}

      {/* Agent (compact) */}
      <FadeIn delay={0.08}>
        {hasAgent ? (
          <AgentView claimId={claim.id} live={live} actions={live ? <ClaimActions claimId={claim.id} status={claim.status} /> : undefined} />
        ) : null}
      </FadeIn>
      {(!hasAgent || !live) && <ClaimActions claimId={claim.id} status={claim.status} />}

      {/* Conversation */}
      <FadeIn delay={0.12}>
        <Conversation messages={messages} brand={brand} waiting={sent && !answered && !["cancelled", "refused"].includes(claim.status)} />
      </FadeIn>

      <details className="rounded-[16px] px-1 text-sm">
        <summary className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink">Historique détaillé</summary>
        <ol className="mt-3 flex flex-col gap-1.5 border-l border-line pl-4 text-[13px]">
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
