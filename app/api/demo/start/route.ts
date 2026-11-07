// OWNER: Dev 2. POST /api/demo/start — jury demo: creates a fresh throwaway account with a copy of the saved demo
// state and returns its credentials (the login page signs in with them). Expired jury accounts (> 30 min) are
// deleted first. Public on purpose (runs before sign-in), capped to a few live accounts.
import { createJuryAccount } from "@/lib/demo/accounts";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";

export const maxDuration = 60;

export async function POST() {
  try {
    const account = await createJuryAccount(createAdminClient());
    if (account === "busy") return apiError(429, "demo_busy", "Beaucoup de démos en cours : réessaye dans quelques minutes.");
    return Response.json(account);
  } catch (e) {
    console.error("[demo start]", e);
    return apiError(500, "demo_failed", "Mince, la démo n'a pas pu démarrer. Réessaye dans un instant.");
  }
}
