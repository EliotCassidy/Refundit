// OWNER: Dev 2. Auth for /api/claims/:id/* : the claim's owner (cookie session)
// or a server-to-server call with x-internal-key.
import "server-only";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { apiError, hasInternalKey } from "@/lib/shared/http";
import type { ClaimRow } from "@/lib/shared/types";

export async function loadClaimForRequest(
  request: Request,
  claimId: string,
): Promise<{ claim: ClaimRow } | { response: Response }> {
  const db = createAdminClient();
  const { data: claim, error } = await db.from("claims").select("*").eq("id", claimId).maybeSingle();
  if (error) return { response: apiError(500, "db_error", error.message) };
  if (!claim) return { response: apiError(404, "not_found", "Claim not found") };

  if (hasInternalKey(request)) return { claim };

  const user = await getUser();
  if (!user) return { response: apiError(401, "unauthenticated", "Sign in required") };
  if (user.id !== claim.user_id) return { response: apiError(404, "not_found", "Claim not found") };
  return { claim };
}
