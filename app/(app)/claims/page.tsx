// OWNER: Dev 2. Claims dashboard: list + status badges.
import Link from "next/link";
import { createClient } from "@/lib/shared/supabase/server";
import { ISSUE_LABELS_FR } from "@/lib/shared/types";
import { AutoRefresh } from "./auto-refresh";
import { StatusBadge } from "./status-badge";

export default async function ClaimsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase
    .from("claims")
    .select("id, status, issue_type, dry_run, created_at, line_items(product_name), brands(name)")
    .order("created_at", { ascending: false });

  const submittingIds = (claims ?? []).filter((c) => c.status === "submitting").map((c) => c.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Mes réclamations</h1>
      {!claims?.length && (
        <p className="text-neutral-500">
          Aucune réclamation pour l&apos;instant.{" "}
          <Link href="/receipts/new" className="underline">Scanner un ticket</Link>
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {claims?.map((c) => (
          <li key={c.id}>
            <Link href={`/claims/${c.id}`} className="flex flex-col gap-1 rounded-xl border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.line_items?.product_name ?? "Produit"}</span>
                <StatusBadge status={c.status} dryRun={c.dry_run} />
              </div>
              <span className="text-sm text-neutral-500">
                {c.brands?.name ? `${c.brands.name} · ` : ""}
                {ISSUE_LABELS_FR[c.issue_type]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <AutoRefresh syncClaimIds={submittingIds} />
    </div>
  );
}
