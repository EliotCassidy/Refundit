// OWNER: Dev 2. POST /api/billing/checkout — starts a Stripe Checkout (subscription, test mode).
import { ensureCustomer, ensurePrice } from "@/lib/billing";
import { apiError } from "@/lib/shared/http";
import { getUser } from "@/lib/shared/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise");
  try {
    const origin = new URL(request.url).origin;
    const [price, customer] = await Promise.all([ensurePrice(), ensureCustomer(user.id, user.email)]);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing`,
      locale: "fr",
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[billing:checkout]", err);
    return apiError(502, "checkout_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
