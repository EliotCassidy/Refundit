// OWNER: Dev 2. Creates (once) a Stripe Connect TEST account for the demo user (Accounts v2,
// "recipient" configuration = can receive funds), stores it in profiles.stripe_account_id, and
// prints a Stripe-hosted onboarding link to complete ONCE in the browser with Stripe test data.
//   npm run stripe:demo-account [-- --email demo@refundit.test]
// Why v2: in test mode Stripe rejected a v1 account with platform-owned losses ("use Accounts v2").
// For the "recipient" configuration v2 requires fees/losses collector = application and an
// "express" (hosted onboarding) or "none" dashboard.
import { parseArgs } from "node:util";
import { config } from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/shared/database.types";

config({ path: ".env.local" });
const { values } = parseArgs({ options: { email: { type: "string" } } });
const email = values.email ?? process.env.SEED_DEMO_EMAIL ?? "demo@refundit.test";
const appUrl = process.env.APP_URL || "http://localhost:3000";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) throw new Error("Set a TEST key (sk_test_…) in STRIPE_SECRET_KEY");
const stripe = new Stripe(key);
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function createAccount(profile: Database["public"]["Tables"]["profiles"]["Row"], dashboard: "express" | "none") {
  return stripe.v2.core.accounts.create({
    contact_email: email,
    display_name: `${profile.first_name} ${profile.last_name}`,
    dashboard,
    identity: {
      country: "fr",
      entity_type: "individual",
      individual: { given_name: profile.first_name, surname: profile.last_name },
    },
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    // Stripe (test mode): a "recipient" account only allows application-owned fees/losses and an
    // "express" or "none" dashboard. v1 refused platform-owned losses, v2 accepts them.
    defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
    metadata: { refundit_user_id: profile.id },
    include: ["configuration.recipient", "requirements"],
  });
}

async function main() {
  const { data: users } = await db.auth.admin.listUsers();
  const user = users?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user ${email}`);
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) throw new Error("User has no profile");

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    let account;
    try {
      account = await createAccount(profile, "express");
    } catch (err) {
      console.log("express dashboard refused:", err instanceof Error ? err.message : err, "→ retrying with none");
      account = await createAccount(profile, "none");
    }
    accountId = account.id;
    await db.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
    console.log("Created", accountId, "dashboard:", account.dashboard);
  }

  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient", "requirements"] });
  const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
  console.log(JSON.stringify({ account: account.id, stripe_transfers: transfers ?? null, requirements: account.requirements?.summary ?? null }, null, 2));

  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: `${appUrl}/claims`,
        return_url: `${appUrl}/claims`,
      },
    },
  });
  console.log("\nOnboarding link (open it, use Stripe's TEST data):\n" + link.url);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
