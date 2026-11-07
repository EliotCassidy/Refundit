// OWNER: Dev 2. Claims dashboard: counters, "to complete" first, then every claim with its status.
import Link from "next/link";
import { createClient } from "@/lib/shared/supabase/server";
import { ISSUE_LABELS_FR, type ClaimStatus } from "@/lib/shared/types";
import { AutoRefresh } from "./auto-refresh";
import { InboxPoller } from "./inbox-poller";
import { StatusBadge } from "./status-badge";

const GROUPS: { label: string; statuses: ClaimStatus[] }[] = [
  { label: "En cours", statuses: ["draft", "submitting", "submitted"] },
  { label: "À compléter", statuses: ["waiting_input", "needs_manual", "agent_failed"] },
  { label: "Acceptées", statuses: ["accepted"] },
  { label: "Refusées", statuses: ["refused"] },
];

export default async function ClaimsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("id, status, issue_type, dry_run, missing_fields, refund_cents, created_at, line_items(product_name, raw_label), brands(name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  const claims = data ?? [];

  const toComplete = claims.filter((c) => c.status === "waiting_input");
  const others = claims.filter((c) => c.status !== "waiting_input");
  const submittingIds = claims.filter((c) => c.status === "submitting").map((c) => c.id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Mes réclamations</h1>

      {claims.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {GROUPS.map((g) => (
            <div key={g.label} className="rounded-xl bg-neutral-500/10 p-2 text-center">
              <div className="text-lg font-semibold">{claims.filter((c) => g.statuses.includes(c.status)).length}</div>
              <div className="text-[11px] leading-tight text-neutral-500">{g.label}</div>
            </div>
          ))}
        </div>
      )}

      {!claims.length && (
        <p className="text-neutral-500">
          Aucune réclamation pour l&apos;instant.{" "}
          <Link href="/receipts/new" className="underline">Scanner un ticket</Link>
        </p>
      )}

      {toComplete.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-amber-700 dark:text-amber-400">Informations demandées ({toComplete.length})</h2>
          <ul className="flex flex-col gap-2">
            {toComplete.map((c) => (
              <li key={c.id}>
                <Link href={`/claims/${c.id}`} className="flex flex-col gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{c.line_items?.product_name ?? "Produit"}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <span className="text-sm text-amber-800 dark:text-amber-300">À renseigner : {c.missing_fields.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <ul className="flex flex-col gap-2">
          {others.map((c) => (
            <li key={c.id}>
              <Link href={`/claims/${c.id}`} className="flex flex-col gap-1 rounded-xl border border-neutral-500/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{c.line_items?.product_name ?? "Produit"}</span>
                  <StatusBadge status={c.status} dryRun={c.dry_run} />
                </div>
                <span className="text-sm text-neutral-500">
                  {c.brands?.name ? `${c.brands.name} · ` : ""}
                  {ISSUE_LABELS_FR[c.issue_type]}
                  {c.refund_cents != null && (
                    <span className="font-medium text-green-700 dark:text-green-500">
                      {" · "}Remboursé {(c.refund_cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AutoRefresh syncClaimIds={submittingIds} />
      <InboxPoller />
    </div>
  );
}
