// OWNER: Dev 2. POST /api/demo/reset — puts the jury demo account back to its saved state (snapshot in private Storage).
// Only the demo account itself can call it.
import { isDemoEmail } from "@/lib/demo/config";
import { loadSnapshot, resetDemoAccount } from "@/lib/demo/reset";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";

export const maxDuration = 60;

export async function POST() {
  const user = await getUser();
  if (!user || !isDemoEmail(user.email)) return apiError(403, "not_demo", "Réservé au compte de démonstration.");
  try {
    const db = createAdminClient();
    const removed = await resetDemoAccount(db, await loadSnapshot(db));
    return Response.json({ ok: true, removed });
  } catch (e) {
    console.error("[demo reset]", e);
    return apiError(500, "reset_failed", "Impossible de réinitialiser la démo.");
  }
}
