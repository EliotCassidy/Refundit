// OWNER: Dev 2. POST /api/demo/start { session } — jury demo login: takes the one-jury lock, then resets the
// demo account to its snapshot. 409 demo_busy when another jury is already on it.
import { z } from "zod";
import { isDemoEmail } from "@/lib/demo/config";
import { acquireDemoLock } from "@/lib/demo/lock";
import { loadSnapshot, resetDemoAccount } from "@/lib/demo/reset";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";

export const maxDuration = 60;
const Body = z.object({ session: z.string().min(8).max(100) });

export async function POST(request: Request) {
  const user = await getUser();
  if (!user || !isDemoEmail(user.email)) return apiError(403, "not_demo", "Réservé au compte de démonstration.");
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_session", "Session de démo invalide.");
  const db = createAdminClient();
  if (!(await acquireDemoLock(db, parsed.data.session))) {
    return apiError(409, "demo_busy", "Mince, un autre jury est déjà connecté, ressaye dans quelques minutes.");
  }
  try {
    const removed = await resetDemoAccount(db, await loadSnapshot(db));
    return Response.json({ ok: true, removed });
  } catch (e) {
    console.error("[demo start]", e);
    return apiError(500, "reset_failed", "Impossible de préparer la démo.");
  }
}
