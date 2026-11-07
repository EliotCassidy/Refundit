// OWNER: Dev 2. GET /api/payouts → the user's Stripe balance (available / pending), bank last 4 and, on the free plan,
// the 20 % commission. POST /api/payouts → pays out the available balance minus that commission (Refundit+: none).
// Stripe TEST mode.
import { FREE_PAYOUT_FEE, isSubscribed } from "@/lib/billing";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { feeFor, getWallet, MIN_PAYOUT_CENTS, payoutAvailable, PayoutTooSmall } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";

async function account() {
  const user = await getUser();
  if (!user) return { error: apiError(401, "unauthenticated", "Connexion requise.") };
  const { data } = await createAdminClient().from("profiles").select("stripe_account_id, subscription_status").eq("id", user.id).maybeSingle();
  if (!stripeConfigured() || !data?.stripe_account_id) {
    return { error: apiError(409, "no_payout_account", "Aucun compte de versement n'est relié à ton profil pour l'instant.") };
  }
  const plus = isSubscribed(data.subscription_status);
  return { userId: user.id, accountId: data.stripe_account_id, plus, feeRate: plus ? 0 : FREE_PAYOUT_FEE };
}

export async function GET() {
  const a = await account();
  if ("error" in a) return a.error;
  try {
    const w = await getWallet(a.accountId);
    return Response.json({ ...w, plan: a.plus ? "plus" : "free", feeRate: a.feeRate, ...feeFor(w.availableCents, a.feeRate), minPayoutCents: MIN_PAYOUT_CENTS });
  } catch (e) {
    console.error("[payouts] wallet", e);
    return apiError(502, "stripe_error", "Solde indisponible pour le moment.");
  }
}

export async function POST() {
  const a = await account();
  if ("error" in a) return a.error;
  try {
    const payout = await payoutAvailable(a.accountId, a.userId, a.feeRate);
    if (!payout) return apiError(409, "nothing_available", "Rien à transférer pour l'instant : tes remboursements sont encore en cours de validation chez Stripe.");
    return Response.json({ payoutId: payout.id, amountCents: payout.amountCents, feeCents: payout.feeCents });
  } catch (e) {
    if (e instanceof PayoutTooSmall) return apiError(409, "payout_too_small", "Il faut au moins 1,00 € à recevoir pour faire un virement.");
    console.error("[payouts] create", e);
    return apiError(502, "stripe_error", "Le virement n'a pas pu être lancé. Réessaie dans un instant.");
  }
}
