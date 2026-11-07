// OWNER: Dev 2. Creates (once) a Stripe Connect TEST account for the demo user, so NotCoca refunds
// can be paid to them, and stores it in profiles.stripe_account_id.
//   npm run stripe:demo-account [-- --email demo@refundit.test]
// Uses Stripe's documented test values (docs.stripe.com/connect/testing): dob 1902-01-01,
// address line1 "address_full_match", test IBAN FR1420041010050500013M02606.
import { parseArgs } from "node:util";
import { config } from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/shared/database.types";

config({ path: ".env.local" });
const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = values.email ?? process.env.SEED_DEMO_EMAIL ?? "demo@refundit.test";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) throw new Error("Set a TEST key (sk_test_…) in STRIPE_SECRET_KEY");
const stripe = new Stripe(key);
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: users } = await db.auth.admin.listUsers();
  const user = users?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user ${email}`);
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) throw new Error("User has no profile");

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      country: "FR",
      email,
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        stripe_dashboard: { type: "none" },
        requirement_collection: "application",
      },
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      business_profile: { mcc: "5734", product_description: "Particulier — remboursements Refundit (démo)" },
      individual: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email,
        phone: "+33600000000",
        dob: { day: 1, month: 1, year: 1902 },
        address: { line1: "address_full_match", city: "Paris", postal_code: "75001", country: "FR" },
      },
      external_account: { object: "bank_account", country: "FR", currency: "eur", account_number: "FR1420041010050500013M02606" },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
      metadata: { refundit_user_id: user.id },
    });
    accountId = account.id;
    await db.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
    console.log("Created", accountId);
  }

  const account = await stripe.accounts.retrieve(accountId);
  console.log(JSON.stringify({
    account: account.id,
    transfers: account.capabilities?.transfers ?? null,
    currently_due: account.requirements?.currently_due ?? [],
    disabled_reason: account.requirements?.disabled_reason ?? null,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
