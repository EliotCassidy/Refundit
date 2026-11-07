// OWNER: Dev 2. POST /api/claims/:id/answers — the user answers the fields the brand's form
// required (claims.missing_fields). Once every field is answered, the claim is resubmitted.
import type { NextRequest } from "next/server";
import { submitClaim } from "@/lib/agent";
import { mockSubmit } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { flags } from "@/lib/shared/env";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { ClaimAnswersBodySchema } from "@/lib/shared/types";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/answers">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (claim.status !== "waiting_input") {
    return apiError(409, "invalid_status", `No information is requested for a claim in status ${claim.status}`);
  }
  const parsed = ClaimAnswersBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.message);

  // Only keep answers to fields that were actually requested.
  const requested = new Set(claim.missing_fields);
  const previous = (claim.user_answers && typeof claim.user_answers === "object" && !Array.isArray(claim.user_answers)
    ? claim.user_answers
    : {}) as Record<string, string>;
  const answers = { ...previous };
  for (const [field, value] of Object.entries(parsed.data.answers)) {
    if (requested.has(field)) answers[field] = value;
  }
  const remaining = claim.missing_fields.filter((f) => !answers[f]);

  const db = createAdminClient();
  const { data: updated, error } = await db
    .from("claims")
    .update({ user_answers: answers })
    .eq("id", claim.id)
    .eq("status", "waiting_input")
    .select("*")
    .single();
  if (error) return apiError(500, "db_error", error.message);

  if (remaining.length) return Response.json({ status: "waiting_input", remaining });

  try {
    if (flags.agentMock()) {
      await mockSubmit(updated);
      return Response.json({ status: "submitting", agentViewUrl: null }, { status: 202 });
    }
    const result = await submitClaim(updated);
    return Response.json(
      { status: result.status, agentViewUrl: result.agentViewUrl, reason: result.reason ?? null },
      { status: result.status === "submitting" ? 202 : 200 },
    );
  } catch (err) {
    console.error("[answers]", err);
    return apiError(500, "submit_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
