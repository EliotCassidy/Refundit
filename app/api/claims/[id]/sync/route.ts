// OWNER: Dev 2. POST /api/claims/:id/sync: polling fallback while status = submitting.
import type { NextRequest } from "next/server";
import { syncClaim } from "@/lib/agent";
import { mockSync } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { apiError } from "@/lib/shared/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/sync">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (claim.status !== "submitting") return Response.json({ status: claim.status });

  try {
    // Mock sessions are recognizable by their id, so a mock claim keeps working if the flag changes.
    if (claim.h_session_id?.startsWith("mock-")) {
      const updated = await mockSync(claim);
      return Response.json({ status: updated.status });
    }
    return Response.json({ status: await syncClaim(claim) });
  } catch (err) {
    console.error("[sync]", err);
    return apiError(502, "sync_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
