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
  // Verified 2026-11-07 by H agent dry run (h/web-surfer-flash): form found and filled in 59 s / 12 steps.
  // Pringles (Kellanova, now Mars) consumer service goes through the Kellogg's France contact page.
  { name: "Pringles", manufacturer: "Kellanova", aliases: ["pringles", "pringl"], source: "seed",
    contact_url: "https://www.kelloggs.fr/fr_FR/contact_us_fr.html", verified: true,
    last_checked_at: "2026-11-07T12:00:00Z" },
  { name: "Evian", manufacturer: "Danone", aliases: ["evian"], source: "seed" },
  // Verified 2026-11-07 by H agent dry run (h/web-surfer-flash): form found and filled in 146 s / 35 steps.
  { name: "Coca-Cola", manufacturer: "The Coca-Cola Company", aliases: ["coca-cola", "coca cola", "coca"], source: "seed",
    contact_url: "https://www.coca-cola.com/fr/fr/about-us/contact-us", verified: true,
    last_checked_at: "2026-11-07T12:00:00Z" },
  // TODO(dev1): add the other demo brands after the spike, with verified contact_url + agent_hints.
];

async function main() {
  // 1. Brands
  const { error: brandsError } = await db.from("brands").upsert(BRANDS, { onConflict: "name", defaultToNull: false });
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

  // 4. One parsed demo receipt (created once), then each demo item is added if missing
  let { data: receipt } = await db.from("receipts").select("id").eq("user_id", user.id)
    .order("created_at").limit(1).maybeSingle();
  if (!receipt) {
    const { data, error } = await db.from("receipts").insert({
      user_id: user.id, image_path: `${user.id}/demo-receipt.jpg`, // no real file: seed data only
      status: "parsed", store_name: "Carrefour Market", purchased_at: new Date().toISOString(), total_cents: 612,
    }).select("id").single();
    if (error) throw error;
    receipt = data;
  }

  const DEMO_ITEMS: Omit<TablesInsert<"line_items">, "receipt_id" | "user_id">[] = [
    { position: 1, raw_label: "PRINGLES ORIG 175G", product_name: "Pringles Original 175g",
      brand_id: brandId("Pringles"), brand_name_guess: "Pringles", quantity: 1, unit_price_cents: 289, total_price_cents: 289 },
    { position: 2, raw_label: "EVIAN 6X1.5L", product_name: "Evian 6 x 1,5 L",
      brand_id: brandId("Evian"), brand_name_guess: "Evian", quantity: 1, unit_price_cents: 323, total_price_cents: 323 },
    { position: 3, raw_label: "COCA COLA 1.75L", product_name: "Coca-Cola Original 1,75 L",
      brand_id: brandId("Coca-Cola"), brand_name_guess: "Coca-Cola", quantity: 1, unit_price_cents: 245, total_price_cents: 245 },
  ];
  const { data: existing } = await db.from("line_items").select("raw_label").eq("receipt_id", receipt.id);
  const missing = DEMO_ITEMS.filter((i) => !existing?.some((e) => e.raw_label === i.raw_label));
  if (missing.length) {
    const { error } = await db.from("line_items")
      .insert(missing.map((i) => ({ ...i, receipt_id: receipt.id, user_id: user.id })));
    if (error) throw error;
  }

  console.log(`Seed OK: ${BRANDS.length} brands, demo user ${demoEmail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
