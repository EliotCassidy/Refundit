// OWNER: Dev 2. POST /api/demo/stop { session } — frees the one-jury lock when the demo is left.
import { z } from "zod";
import { isDemoEmail } from "@/lib/demo/config";
import { releaseDemoLock } from "@/lib/demo/lock";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";

const Body = z.object({ session: z.string().min(8).max(100) });

export async function POST(request: Request) {
  const user = await getUser();
  if (!user || !isDemoEmail(user.email)) return apiError(403, "not_demo", "Réservé au compte de démonstration.");
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_session", "Session de démo invalide.");
  await releaseDemoLock(createAdminClient(), parsed.data.session);
  return Response.json({ ok: true });
}
