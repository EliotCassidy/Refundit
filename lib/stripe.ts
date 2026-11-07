// OWNER: Dev 2. Stripe client — TEST MODE ONLY for this hackathon: any non sk_test_ key is refused,
// so a demo can never move real money.
import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_test_")) throw new Error("Refusing a non-test Stripe key (hackathon demo: test mode only)");
  client ??= new Stripe(key);
  return client;
}
