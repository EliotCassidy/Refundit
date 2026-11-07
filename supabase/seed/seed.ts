// OWNER: Dev 1. `npm run seed`: brands registry + a demo user with a parsed receipt.
// Idempotent: safe to run several times. Reads .env.local.
//
// Brand contact URLs are intentionally NULL until verified during the H spike
// (IMPLEMENTATION_PLAN.md Phase 1). Never put an unverified URL here.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "../../lib/shared/database.types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.SEED_DEMO_EMAIL ?? "demo@refundit.test";
const demoPassword = process.env.SEED_DEMO_PASSWORD;
if (!url || !serviceKey || !demoPassword) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_DEMO_PASSWORD in .env.local");
}

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

const BRANDS: TablesInsert<"brands">[] = [
  { name: "Pringles", manufacturer: "Kellanova", aliases: ["pringles", "pringl"], source: "seed" },
  { name: "Evian", manufacturer: "Danone", aliases: ["evian"], source: "seed" },
  // TODO(dev1): add the other demo brands after the spike, with verified contact_url + agent_hints.
];

async function main() {
  // 1. Brands
  const { error: brandsError } = await db.from("brands").upsert(BRANDS, { onConflict: "name" });
  if (brandsError) throw brandsError;
  const { data: brands } = await db.from("brands").select("id, name");
  const brandId = (name: string) => brands?.find((b) => b.name === name)?.id ?? null;

  // 2. Demo user (email confirmed so login works immediately)
  const { data: list } = await db.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === demoEmail);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: demoEmail, password: demoPassword, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }

  // 3. Profile
  const { error: profileError } = await db.from("profiles").upsert({
    id: user.id, first_name: "Camille", last_name: "Démo", phone: "0600000000",
    address_line1: "1 rue de la Démo", postal_code: "75001", city: "Paris",
  });
  if (profileError) throw profileError;

  // 4. One parsed demo receipt (only if the user has none)
  const { count } = await db.from("receipts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count) {
    const { data: receipt, error } = await db.from("receipts").insert({
      user_id: user.id, image_path: `${user.id}/demo-receipt.jpg`, // no real file: seed data only
      status: "parsed", store_name: "Carrefour Market", purchased_at: new Date().toISOString(), total_cents: 612,
    }).select("id").single();
    if (error) throw error;

    const { error: itemsError } = await db.from("line_items").insert([
      { receipt_id: receipt.id, user_id: user.id, position: 1, raw_label: "PRINGLES ORIG 175G",
        product_name: "Pringles Original 175g", brand_id: brandId("Pringles"), brand_name_guess: "Pringles",
        quantity: 1, unit_price_cents: 289, total_price_cents: 289 },
      { receipt_id: receipt.id, user_id: user.id, position: 2, raw_label: "EVIAN 6X1.5L",
        product_name: "Evian 6 x 1,5 L", brand_id: brandId("Evian"), brand_name_guess: "Evian",
        quantity: 1, unit_price_cents: 323, total_price_cents: 323 },
    ]);
    if (itemsError) throw itemsError;
  }

  console.log(`Seed OK: ${BRANDS.length} brands, demo user ${demoEmail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
