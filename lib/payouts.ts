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

/** Stripe refuses EUR payouts under €1.00 (amount_too_small, seen in test mode 2026-11-07). */
export const MIN_PAYOUT_CENTS = 100;

export class PayoutTooSmall extends Error {}

/** What a transfer of the available balance gives, with the free-plan commission. */
export function feeFor(availableCents: number, feeRate: number) {
  const feeCents = Math.round(availableCents * feeRate);
  return { feeCents, netCents: availableCents - feeCents };
}

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

/**
 * Free-plan commission: Refundit takes it back from the refunds it transferred to the user (transfer reversals:
 * POST /v1/transfers/:id/reversals moves funds from the connected account back to the platform; verified in
 * test mode 2026-11-07). Taken from the newest transfers first (their funds are the available ones), so the
 * available balance ends at 0 after the payout.
 */
async function collectFee(accountId: string, feeCents: number, key: string) {
  const s = stripe();
  let left = feeCents;
  const transfers = await s.transfers.list({ destination: accountId, limit: 100 });
  for (const t of transfers.data) {
    if (left <= 0) break;
    const reversible = t.amount - t.amount_reversed;
    if (reversible <= 0) continue;
    const amount = Math.min(left, reversible);
    await s.transfers.createReversal(t.id, { amount, metadata: { reason: "refundit_payout_fee" } }, { idempotencyKey: `${key}-fee-${t.id}` });
    left -= amount;
  }
  if (left > 0) throw new Error(`fee not fully collected (${left} cents left)`);
}

/** Pays out the whole available EUR balance, minus the commission (feeRate, 0 for Refundit+).
 *  Returns null when there is nothing available. */
export async function payoutAvailable(accountId: string, userId: string, feeRate = 0): Promise<{ id: string; amountCents: number; feeCents: number } | null> {
  const s = stripe();
  const { availableCents } = await getWallet(accountId);
  if (availableCents <= 0) return null;
  const { feeCents, netCents } = feeFor(availableCents, feeRate);
  // Checked BEFORE taking the commission: never keep a fee for a transfer that can't happen.
  if (netCents < MIN_PAYOUT_CENTS) throw new PayoutTooSmall(`net ${netCents} < ${MIN_PAYOUT_CENTS}`);
  const key = `refundit-payout-${accountId}-${availableCents}-${new Date().toISOString().slice(0, 13)}`;
  if (feeCents > 0) await collectFee(accountId, feeCents, key);
  const payout = await s.payouts.create(
    { amount: netCents, currency: "eur", description: "Refundit – remboursements", metadata: { user_id: userId, fee_cents: String(feeCents) } },
    { stripeAccount: accountId, idempotencyKey: key },
  );
  return { id: payout.id, amountCents: payout.amount, feeCents };
}
