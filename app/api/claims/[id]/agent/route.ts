// OWNER: Dev 2. GET /api/claims/:id/agent — the agent's steps for the built-in Agent View
// (owner only). Screenshot URLs are rewritten to our proxy route.
import type { NextRequest } from "next/server";
import { getAgentSteps } from "@/lib/agent/view";
import { loadClaimForRequest } from "@/lib/claims/access";
import { apiError } from "@/lib/shared/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/agent">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const sessionId = loaded.claim.h_session_id;
  if (!sessionId || sessionId.startsWith("mock-")) return Response.json({ status: loaded.claim.status, steps: [] });
  try {
    const steps = (await getAgentSteps(sessionId)).map((s) => ({
      ...s,
      screenshot: s.screenshot ? `/api/claims/${id}/agent/screenshot?src=${encodeURIComponent(s.screenshot)}` : null,
    }));
    return Response.json({ status: loaded.claim.status, steps });
  } catch (err) {
    return apiError(502, "agent_view_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
