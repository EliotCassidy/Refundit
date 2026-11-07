// OWNER: Dev 2. GET /api/payouts → the user's Stripe balance (available / pending) + bank last 4.
// POST /api/payouts → pays out the whole available balance to that bank account (Stripe TEST mode).
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { getWallet, payoutAvailable } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";

async function account() {
  const user = await getUser();
  if (!user) return { error: apiError(401, "unauthenticated", "Connexion requise.") };
  const { data } = await createAdminClient().from("profiles").select("stripe_account_id").eq("id", user.id).maybeSingle();
  if (!stripeConfigured() || !data?.stripe_account_id) {
    return { error: apiError(409, "no_payout_account", "Aucun compte de versement n'est relié à ton profil pour l'instant.") };
  }
  return { userId: user.id, accountId: data.stripe_account_id };
}

export async function GET() {
  const a = await account();
  if ("error" in a) return a.error;
  try {
    return Response.json(await getWallet(a.accountId));
  } catch (e) {
    console.error("[payouts] wallet", e);
    return apiError(502, "stripe_error", "Solde indisponible pour le moment.");
  }
}

export async function POST() {
  const a = await account();
  if ("error" in a) return a.error;
  try {
    const payout = await payoutAvailable(a.accountId, a.userId);
    if (!payout) return apiError(409, "nothing_available", "Rien à transférer pour l'instant : tes remboursements sont encore en cours de validation chez Stripe.");
    return Response.json({ payoutId: payout.id, amountCents: payout.amountCents });
  } catch (e) {
    console.error("[payouts] create", e);
    return apiError(502, "stripe_error", "Le virement n'a pas pu être lancé. Réessaie dans un instant.");
  }
}
