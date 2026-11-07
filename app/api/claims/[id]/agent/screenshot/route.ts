// OWNER: Dev 2. GET /api/claims/:id/agent/screenshot?src=… — proxies one H screenshot of this
// claim's session to its owner (the H resource needs our API key; never exposed to the browser).
import type { NextRequest } from "next/server";
import { fetchResource, isSessionResource } from "@/lib/agent/view";
import { loadClaimForRequest } from "@/lib/claims/access";
import { apiError } from "@/lib/shared/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/agent/screenshot">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const src = request.nextUrl.searchParams.get("src") ?? "";
  const sessionId = loaded.claim.h_session_id ?? "";
  if (!sessionId || !isSessionResource(src, sessionId)) return apiError(400, "invalid_src", "Unknown screenshot");
  const res = await fetchResource(src);
  if (!res.ok) return apiError(502, "screenshot_failed", `H returned ${res.status}`);
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
