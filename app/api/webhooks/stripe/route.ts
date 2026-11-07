// OWNER: Dev 2. Stripe webhook (subscription lifecycle: renewals, payment failures, cancellations).
// Register on the deployed URL: Stripe Dashboard (test mode) → Developers → Webhooks →
// https://<app>/api/webhooks/stripe, events customer.subscription.created|updated|deleted;
// put the signing secret (whsec_…) in STRIPE_WEBHOOK_SECRET.
import { applySubscription } from "@/lib/billing";
import { apiError } from "@/lib/shared/http";
import { stripe } from "@/lib/stripe";

const EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return apiError(500, "not_configured", "STRIPE_WEBHOOK_SECRET is not set");
  const raw = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return apiError(400, "invalid_signature", "Invalid signature");
  }
  if (EVENTS.has(event.type)) {
    await applySubscription(event.data.object as import("stripe").Stripe.Subscription);
  }
  return Response.json({ received: true });
}
