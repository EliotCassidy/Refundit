// Jury demo account (refundit@demo.fr).
//   npm run demo -- snapshot   save the account as it is now (private Storage: receipts/_demo/snapshot.json)
//   npm run demo -- reset      put the account back to that snapshot
//   npm run demo -- password   set the password typed by the login page's "Mode démo" (demo123)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/shared/database.types";
import { DEMO_PASSWORD } from "../lib/demo/config";
import { demoUserId, loadSnapshot, resetDemoAccount, saveSnapshot, takeSnapshot } from "../lib/demo/reset";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const cmd = process.argv[2];

async function main() {
  if (cmd === "snapshot") {
    const snap = await takeSnapshot(db);
    await saveSnapshot(db, snap);
    console.log(`saved: ${snap.receipts.length} receipts, ${snap.line_items.length} items, ${snap.claims.length} claims, ${snap.claim_emails.length} emails`);
  } else if (cmd === "reset") {
    console.log("removed", await resetDemoAccount(db, await loadSnapshot(db)));
  } else if (cmd === "password") {
    const id = await demoUserId(db);
    const { error } = await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
    if (error) throw error;
    console.log("password set");
  } else {
    console.log("usage: npm run demo -- snapshot | reset | password");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
