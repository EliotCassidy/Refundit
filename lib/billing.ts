// OWNER: Dev 2. Subscription "Refundit+" (Stripe Billing, TEST mode), €9.99/month.
// Free plan: FREE_SCANS_PER_MONTH receipt scans per calendar month (Europe/Paris) and a FREE_PAYOUT_FEE
// commission when the user transfers refunds to their bank (lib/payouts.ts).
// Refundit+ (status active/trialing): unlimited scans, no commission.
import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { stripe } from "@/lib/stripe";

export const FREE_SCANS_PER_MONTH = 5;
/** Commission kept by Refundit on transfers to the bank, free plan only (Refundit+ = 0). */
export const FREE_PAYOUT_FEE = 0.2;
export const PLAN = { name: "Refundit+", amountCents: 999, currency: "eur", lookupKey: "refundit_unlimited_monthly" } as const;

const ACTIVE = new Set(["active", "trialing"]);

export type ScanQuota = {
  plan: "free" | "unlimited";
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  canScan: boolean;
};

function startOfMonthParis(now = new Date()): Date {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const offsetMs = paris.getTime() - now.getTime();
  return new Date(new Date(paris.getFullYear(), paris.getMonth(), 1).getTime() - offsetMs);
}

/** Quota of a user. Dev 1's POST /api/receipts must refuse with 402 when !canScan. */
export async function getScanQuota(userId: string): Promise<ScanQuota> {
  const db = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    db.from("profiles").select("subscription_status").eq("id", userId).maybeSingle(),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonthParis().toISOString()),
  ]);
  const used = count ?? 0;
  if (profile?.subscription_status && ACTIVE.has(profile.subscription_status)) {
    return { plan: "unlimited", used, limit: null, remaining: null, canScan: true };
  }
  const remaining = Math.max(0, FREE_SCANS_PER_MONTH - used);
  return { plan: "free", used, limit: FREE_SCANS_PER_MONTH, remaining, canScan: remaining > 0 };
}

/** The monthly price, found by lookup_key and created once if missing (test mode). */
export async function ensurePrice(): Promise<string> {
  const s = stripe();
  const existing = await s.prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const price = await s.prices.create({
    currency: PLAN.currency,
    unit_amount: PLAN.amountCents,
    recurring: { interval: "month" },
    lookup_key: PLAN.lookupKey,
    product_data: { name: PLAN.name },
  });
  return price.id;
}

export async function ensureCustomer(userId: string, email: string | undefined): Promise<string> {
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("stripe_customer_id, first_name, last_name").eq("id", userId).single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await stripe().customers.create({
    email,
    name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
    metadata: { refundit_user_id: userId },
  });
  await db.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);
  return customer.id;
}

/** Copies a Stripe subscription's state onto the profile (from Checkout return or webhook). */
export async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = sub.items.data[0]?.current_period_end;
  await createAdminClient()
    .from("profiles")
    .update({
      subscription_status: sub.status,
      subscription_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq("stripe_customer_id", customerId);
}

/** Subscription active (Refundit+)? */
export const isSubscribed = (status: string | null | undefined) => Boolean(status && ACTIVE.has(status));
