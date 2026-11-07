// OWNER: Dev 2. POST /api/billing/cancel — cancels the subscription at the end of the period.
import { applySubscription } from "@/lib/billing";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { getUser } from "@/lib/shared/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise");
  const { data: profile } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  if (!profile?.stripe_customer_id) return apiError(404, "no_subscription", "Aucun abonnement");
  try {
    const subs = await stripe().subscriptions.list({ customer: profile.stripe_customer_id, status: "active", limit: 1 });
    const sub = subs.data[0];
    if (!sub) return apiError(404, "no_subscription", "Aucun abonnement actif");
    const updated = await stripe().subscriptions.update(sub.id, { cancel_at_period_end: true });
    await applySubscription(updated);
    return Response.json({ cancelAtPeriodEnd: true });
  } catch (err) {
    console.error("[billing:cancel]", err);
    return apiError(502, "cancel_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
