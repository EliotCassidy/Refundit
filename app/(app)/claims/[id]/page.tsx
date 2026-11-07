// OWNER: Dev 2. Claim detail: status, Agent View (live/replay), complaint text,
// Cancel / Retry, timeline (status changes + brand emails).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/server";
import { CLAIM_STATUS_LABELS_FR, ISSUE_LABELS_FR } from "@/lib/shared/types";
import { AutoRefresh } from "../auto-refresh";
import { StatusBadge } from "../status-badge";
import { AgentView } from "./agent-view";
import { ClaimActions } from "./claim-actions";
import { MissingInfoForm } from "./missing-info-form";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select("*, line_items(product_name), brands(name), receipts(store_name, purchased_at)")
    .eq("id", id)
    .maybeSingle();
  if (!claim) notFound();

  const [{ data: events }, { data: emails }] = await Promise.all([
    supabase.from("claim_events").select("*").eq("claim_id", id).order("created_at"),
    supabase.from("claim_emails").select("*").eq("claim_id", id).order("received_at"),
  ]);

  const timeline = [
    ...(events ?? [])
      .filter((e) => e.type === "status_change" && e.to_status)
      .map((e) => ({ at: e.created_at, key: e.id, title: CLAIM_STATUS_LABELS_FR[e.to_status!], body: null as string | null })),
    ...(emails ?? []).map((m) => ({
      at: m.received_at,
      key: m.id,
      title: `Réponse de ${m.from_address}`,
      body: [m.subject, m.body_text].filter(Boolean).join("\n\n"),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/claims" className="text-sm text-neutral-500">← Réclamations</Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold">{claim.line_items?.product_name ?? "Produit"}</h1>
          <StatusBadge status={claim.status} dryRun={claim.dry_run} />
        </div>
        <p className="text-sm text-neutral-500">
          {claim.brands?.name ? `${claim.brands.name} · ` : ""}
          {ISSUE_LABELS_FR[claim.issue_type]}
        </p>
        {claim.submission_channel && (
          <p className="text-sm text-neutral-500">
            Envoyée via {claim.submission_channel === "email" ? "e-mail au service client" : "le formulaire de contact de la marque"}
          </p>
        )}
        {claim.refund_cents != null && (
          <p className="rounded-lg bg-green-50 p-2 text-sm text-green-900">
            Remboursement reçu : <strong>{(claim.refund_cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong>
            {claim.stripe_payment_id && <span className="text-green-800/70"> · Stripe {claim.stripe_payment_id}</span>}
          </p>
        )}
        {claim.confirmation_number && (
          <p className="text-sm">N° de confirmation : <strong>{claim.confirmation_number}</strong></p>
        )}
        {claim.failure_reason && ["needs_manual", "agent_failed"].includes(claim.status) && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{claim.failure_reason}</p>
        )}
      </header>

      {claim.h_session_id && !claim.h_session_id.startsWith("mock-") && (
        <AgentView claimId={claim.id} live={claim.status === "submitting"} />
      )}

      {claim.status === "waiting_input" && claim.missing_fields.length > 0 && (
        <MissingInfoForm
          claimId={claim.id}
          fields={claim.missing_fields}
          answers={(claim.user_answers ?? {}) as Record<string, string>}
        />
      )}

      <ClaimActions claimId={claim.id} status={claim.status} />

      {claim.complaint_text && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Message envoyé à la marque</h2>
          <pre className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 font-sans text-sm text-neutral-800">
            {claim.complaint_text}
          </pre>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Historique</h2>
        <ol className="flex flex-col gap-3 border-l border-neutral-200 pl-4">
          <li className="text-sm">
            <span className="text-neutral-500">{fmt(claim.created_at)}</span> · Réclamation créée
          </li>
          {timeline.map((t) => (
            <li key={t.key} className="text-sm">
              <span className="text-neutral-500">{fmt(t.at)}</span> · {t.title}
              {t.body && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-neutral-50 p-2">{t.body}</p>}
            </li>
          ))}
        </ol>
      </section>

      <AutoRefresh syncClaimIds={claim.status === "submitting" ? [claim.id] : []} />
    </div>
  );
}
