// OWNER: Dev 2. POST /api/claims/:id/sync: polling fallback while status = submitting.
import type { NextRequest } from "next/server";
import { mockSync } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { flags } from "@/lib/shared/env";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/sync">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (claim.status !== "submitting") return Response.json({ status: claim.status });

  if (flags.agentMock()) {
    const updated = await mockSync(claim);
    return Response.json({ status: updated.status });
  }

  // TODO(dev2): GET the H session; if terminal, map the outcome (ARCHITECTURE.md §5.3).
  return Response.json({ status: claim.status });
}
