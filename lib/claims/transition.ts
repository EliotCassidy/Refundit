// OWNER: Dev 2. The ONLY way to change claims.status after 'draft' (CLAUDE.md rule 4).
// Allowed transitions: API_CONTRACTS §1.
import "server-only";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import type { ClaimRow, ClaimStatus } from "@/lib/shared/types";
import type { Json, TablesUpdate } from "@/lib/shared/database.types";

export const ALLOWED_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  draft: ["submitting", "cancelled"],
  submitting: ["submitted", "waiting_input", "needs_manual", "agent_failed", "cancelled"],
  agent_failed: ["submitting"],
  needs_manual: ["submitting", "cancelled"],
  submitted: ["waiting_input", "accepted", "refused"],
  waiting_input: ["submitting", "submitted", "accepted", "refused", "cancelled"],
  accepted: [],
  refused: [],
  cancelled: [],
};

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(public from: ClaimStatus, public to: ClaimStatus) {
    super(`Illegal claim transition ${from} → ${to}`);
  }
}

/**
 * Moves a claim to `to`, optionally updating other claim columns in the same write,
 * and records a status_change event. Throws IllegalTransitionError if not allowed.
 * Uses a compare-and-set on the current status to avoid races (webhook vs. /sync).
 */
export async function transitionClaim(
  claimId: string,
  to: ClaimStatus,
  opts: { payload?: Record<string, unknown>; patch?: Omit<TablesUpdate<"claims">, "status"> } = {},
): Promise<ClaimRow> {
  const db = createAdminClient();
  const { data: claim, error } = await db.from("claims").select("*").eq("id", claimId).single();
  if (error) throw error;

  const from = claim.status;
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);

  const now = new Date().toISOString();
  const patch: TablesUpdate<"claims"> = { ...opts.patch, status: to };
  // Requested fields only make sense while waiting for the user.
  if (to !== "waiting_input" && claim.missing_fields.length && !opts.patch?.missing_fields) patch.missing_fields = [];
  if (to === "submitted" && !claim.submitted_at) patch.submitted_at = now;
  if (to === "accepted" || to === "refused") patch.resolved_at = now;

  const { data: updated, error: updateError } = await db
    .from("claims")
    .update(patch)
    .eq("id", claimId)
    .eq("status", from) // compare-and-set
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new IllegalTransitionError(from, to); // status changed concurrently

  await db.from("claim_events").insert({
    claim_id: claimId,
    type: "status_change",
    from_status: from,
    to_status: to,
    payload: (opts.payload ?? null) as Json,
  });

  return updated;
}
