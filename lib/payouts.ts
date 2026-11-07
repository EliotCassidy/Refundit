// OWNER: Dev 2. "Transférer vers mon compte": pays out the user's Stripe Connect balance (refunds received)
// to the bank account attached to their connected account. TEST MODE ONLY (lib/stripe refuses live keys).
//
// Docs checked (docs.stripe.com):
// - connect/payouts-connected-accounts: the platform can create manual payouts for a connected account
//   (Payouts API acting as the account, Stripe-Account header).
// - api/payouts/create: the balance must cover the payout amount.
// Verified in test mode (2026-11-07) on the demo v2 account: a manual payout is accepted while its schedule
// is still automatic (daily), so we don't change the schedule.
import "server-only";
import { stripe } from "@/lib/stripe";

export type Wallet = { availableCents: number; pendingCents: number; bankLast4: string | null };

export async function getWallet(accountId: string): Promise<Wallet> {
  const s = stripe();
  const [balance, account] = await Promise.all([s.balance.retrieve({}, { stripeAccount: accountId }), s.accounts.retrieve(accountId)]);
  const eur = (list: { amount: number; currency: string }[]) => list.filter((b) => b.currency === "eur").reduce((t, b) => t + b.amount, 0);
  const bank = account.external_accounts?.data.find((e) => e.object === "bank_account");
  return {
    availableCents: eur(balance.available),
    pendingCents: eur(balance.pending),
    bankLast4: bank && "last4" in bank ? bank.last4 : null,
  };
}

/** Pays out the whole available EUR balance. Returns null when there is nothing available. */
export async function payoutAvailable(accountId: string, userId: string): Promise<{ id: string; amountCents: number } | null> {
  const s = stripe();
  const { availableCents } = await getWallet(accountId);
  if (availableCents <= 0) return null;
  const payout = await s.payouts.create(
    { amount: availableCents, currency: "eur", description: "Refundit – remboursements", metadata: { user_id: userId } },
    { stripeAccount: accountId, idempotencyKey: `refundit-payout-${accountId}-${availableCents}-${new Date().toISOString().slice(0, 13)}` },
  );
  return { id: payout.id, amountCents: payout.amount };
}
