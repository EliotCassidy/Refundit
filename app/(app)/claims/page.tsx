// OWNER: Dev 2. Claims dashboard: list + status badges.
import Link from "next/link";
import { createClient } from "@/lib/shared/supabase/server";
import { CLAIM_STATUS_LABELS_FR, ISSUE_LABELS_FR } from "@/lib/shared/types";

export default async function ClaimsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase
    .from("claims")
    .select("id, status, issue_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Mes réclamations</h1>
      {!claims?.length && <p className="text-neutral-500">Aucune réclamation pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-2">
        {claims?.map((c) => (
          <li key={c.id}>
            <Link href={`/claims/${c.id}`} className="flex justify-between rounded-lg border border-neutral-200 p-3">
              <span>{ISSUE_LABELS_FR[c.issue_type]}</span>
              <span className="text-sm">{CLAIM_STATUS_LABELS_FR[c.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* TODO(dev2): product + brand names, colored badges, polling of submitting claims */}
    </div>
  );
}
