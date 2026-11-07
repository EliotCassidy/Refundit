// OWNER: Dev 2. POST /api/claims/:id/submit (API_CONTRACTS §5).
import type { NextRequest } from "next/server";
import { mockSubmit } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { canTransition } from "@/lib/claims/transition";
import { flags } from "@/lib/shared/env";
import { apiError, notImplemented } from "@/lib/shared/http";

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

  // TODO(dev2): real flow (ARCHITECTURE.md §4.3):
  // getBrandContact → needs_manual if no contactUrl → inbound alias → complaint text
  // → H session (lib/agent) → transitionClaim(submitting) → 202 { status, agentViewUrl }
  return notImplemented("Real agent submission (set AGENT_MOCK=true meanwhile)");
}
