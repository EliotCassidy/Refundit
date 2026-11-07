// OWNER: Dev 2. POST /api/notcoca/admin/requests/:id/decision — NotCoca admin refunds or rejects.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/notcoca/admin";
import { decide } from "@/lib/notcoca/decision";
import { apiError } from "@/lib/shared/http";

export const maxDuration = 60;

const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("refund"), refundCents: z.number().int().min(0).max(100_00), compensationCents: z.number().int().min(0).max(100_00) }),
  z.object({ kind: z.literal("reject"), reason: z.string().trim().min(3).max(500) }),
]);

export async function POST(request: NextRequest, ctx: RouteContext<"/api/notcoca/admin/requests/[id]/decision">) {
  if (!(await isAdmin())) return apiError(401, "unauthorized", "Admin NotCoca uniquement");
  const { id } = await ctx.params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.message);
  try {
    return Response.json(await decide(id, parsed.data));
  } catch (err) {
    console.error("[notcoca:decision]", err);
    return apiError(500, "decision_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
