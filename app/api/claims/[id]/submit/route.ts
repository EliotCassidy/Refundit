// OWNER: Dev 2. POST /api/claims/:id/submit (API_CONTRACTS §5).
import type { NextRequest } from "next/server";
import { submitClaim } from "@/lib/agent";
import { mockSubmit } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { canTransition, IllegalTransitionError } from "@/lib/claims/transition";
import { flags } from "@/lib/shared/env";
import { apiError } from "@/lib/shared/http";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/submit">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (!canTransition(claim.status, "submitting")) {
    return apiError(409, "invalid_status", `Cannot submit a claim in status ${claim.status}`);
  }

  if (flags.agentMock()) {
    await mockSubmit(claim);
    return Response.json({ status: "submitting", agentViewUrl: null }, { status: 202 });
  }

  try {
    const result = await submitClaim(claim);
    if (result.status === "submitting") {
      return Response.json({ status: result.status, agentViewUrl: result.agentViewUrl }, { status: 202 });
    }
    return Response.json({ status: result.status, reason: result.reason ?? null });
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return apiError(409, "invalid_status", "Claim was submitted concurrently");
    }
    console.error("[submit]", err);
    return apiError(500, "submit_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
