// OWNER: Dev 2. NotCoca pays the refund to the customer through Stripe Connect (TEST mode).
// Destination charge (docs.stripe.com/connect/destination-charges): ONE PaymentIntent paid with the
// test card pm_card_visa, transfer_data.destination = the user's connected account. No platform
// balance needed; FR platform → FR account in EUR needs no on_behalf_of.
//
// Demo shortcut (stated in the pitch): NotCoca and Refundit share the same Stripe test platform, and
// the payee is found from the claim's plus address. A real brand would pay to the IBAN given in the form.
import "server-only";
import { findAlias } from "@/lib/email/address";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function payRefund(input: { customerEmail: string; amountCents: number; ticketNumber: string }): Promise<{ id: string } | null> {
  if (!stripeConfigured() || input.amountCents <= 0) return null;

  const alias = findAlias([input.customerEmail], "", "");
  if (!alias) return null; // not a Refundit customer: refund announced by email only
  const db = createAdminClient();
  const { data: claim } = await db.from("claims").select("id, user_id").eq("inbound_alias", alias).maybeSingle();
  if (!claim) return null;
  const { data: profile } = await db.from("profiles").select("stripe_account_id").eq("id", claim.user_id).maybeSingle();
  if (!profile?.stripe_account_id) return null; // user has no connected account yet

  const pi = await stripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: "eur",
      payment_method: "pm_card_visa", // Stripe test payment method
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      transfer_data: { destination: profile.stripe_account_id },
      description: `NotCoca – remboursement ${input.ticketNumber}`,
      metadata: { claim_id: claim.id, ticket_number: input.ticketNumber, demo: "notcoca" },
    },
    { idempotencyKey: `notcoca-refund-${input.ticketNumber}` },
  );
  if (pi.status !== "succeeded") throw new Error(`Stripe payment ${pi.id} is ${pi.status}`);

  await db.from("claims").update({ refund_cents: input.amountCents, stripe_payment_id: pi.id }).eq("id", claim.id);
  return { id: pi.id };
}
