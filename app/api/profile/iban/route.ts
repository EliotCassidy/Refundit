// POST /api/profile/iban { iban } — sets the signed-in user's IBAN only (RLS "own profile").
// Used by the dashboard reminder; the full profile form stays on POST /api/profile.
import { z } from "zod";
import { apiError } from "@/lib/shared/http";
import { isValidIban, normalizeIban } from "@/lib/shared/iban";
import { createClient, getUser } from "@/lib/shared/supabase/server";

const Body = z.object({ iban: z.string().trim().min(1) });

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise.");
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidIban(parsed.data.iban)) return apiError(400, "invalid_iban", "IBAN invalide : vérifiez les chiffres.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ iban: normalizeIban(parsed.data.iban) }).eq("id", user.id);
  if (error) return apiError(500, "profile_error", "Impossible d'enregistrer l'IBAN. Réessayez.");
  return Response.json({ ok: true });
}
