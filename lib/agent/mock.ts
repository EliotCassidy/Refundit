// OWNER: Dev 2. AGENT_MOCK=true simulation (API_CONTRACTS §5 "Mock mode").
// Lets Dev 1 build the whole user flow before the real H integration exists.
import "server-only";
import { transitionClaim } from "@/lib/claims/transition";
import type { ClaimRow } from "@/lib/shared/types";

const MOCK_DURATION_MS = 10_000;

export async function mockSubmit(claim: ClaimRow): Promise<ClaimRow> {
  return transitionClaim(claim.id, "submitting", {
    payload: { mock: true },
    patch: {
      attempt: claim.attempt + 1,
      h_session_id: `mock-${claim.id}`,
      h_agent_view_url: null,
      complaint_text: "[MOCK] Texte de réclamation généré par Dev 2.",
      dry_run: true,
    },
  });
}

/** Called by /sync: after ~10s a mock run "succeeds". */
export async function mockSync(claim: ClaimRow): Promise<ClaimRow> {
  if (claim.status !== "submitting") return claim;
  if (Date.now() - new Date(claim.updated_at).getTime() < MOCK_DURATION_MS) return claim;
  return transitionClaim(claim.id, "submitted", {
    payload: { mock: true },
    patch: { confirmation_number: "MOCK-0001" },
  });
}
