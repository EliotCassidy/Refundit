// OWNER: Dev 2. POST /api/claims/:id/cancel.
import type { NextRequest } from "next/server";
import { cancelClaimSession } from "@/lib/agent";
import { loadClaimForRequest } from "@/lib/claims/access";
import { canTransition, transitionClaim } from "@/lib/claims/transition";
import { apiError } from "@/lib/shared/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/cancel">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (!canTransition(claim.status, "cancelled")) {
    return apiError(409, "invalid_status", `Cannot cancel a claim in status ${claim.status}`);
  }

  // Mark cancelled first so the "interrupted" webhook that follows is ignored.
  await transitionClaim(claim.id, "cancelled", { payload: { by: "user" } });
  await cancelClaimSession(claim);
  return Response.json({ status: "cancelled" });
}
