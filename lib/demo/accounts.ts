// OWNER: Dev 2. Jury demo: every "Mode démo" gets its OWN throwaway account, cloned from the saved demo state
// (snapshot of refundit@demo.fr, private Storage). No lock, no jury stepping on another. Accounts are deleted
// 30 minutes after creation (lazily, each time a new demo starts): auth user → cascade on all their rows,
// plus the NotCoca back-office requests their claims sent.
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newAlias, plusAddress } from "@/lib/email/address";
import type { Database } from "@/lib/shared/database.types";
import { isJuryEmail, juryEmail } from "./config";
import { loadSnapshot } from "./reset";

type Db = SupabaseClient<Database>;
type Row = Record<string, unknown> & { id: string };

export const JURY_TTL_MS = 30 * 60_000;
const MAX_LIVE = 25; // guard: this endpoint is public (it runs before sign-in)

async function juryUsers(db: Db) {
  const out: { id: string; email: string; created_at: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (isJuryEmail(u.email)) out.push({ id: u.id, email: u.email!, created_at: u.created_at });
    if (data.users.length < 200) break;
  }
  return out;
}

export async function deleteJuryAccount(db: Db, userId: string) {
  const { data: claims } = await db.from("claims").select("inbound_alias").eq("user_id", userId);
  const emails = (claims ?? []).map((c) => (c.inbound_alias ? plusAddress(c.inbound_alias) : null)).filter((e): e is string => Boolean(e));
  if (emails.length) await db.from("notcoca_requests").delete().in("email", emails);
  const { error } = await db.auth.admin.deleteUser(userId); // cascades to profile, receipts, items, claims, events, emails
  if (error) throw error;
}

/** Deletes jury accounts older than 30 minutes. Returns how many are still alive. */
export async function cleanupJuryAccounts(db: Db): Promise<number> {
  const users = await juryUsers(db);
  let alive = 0;
  for (const u of users) {
    if (Date.now() - new Date(u.created_at).getTime() > JURY_TTL_MS) {
      await deleteJuryAccount(db, u.id).catch((e) => console.error("[demo cleanup]", u.email, e));
    } else alive++;
  }
  return alive;
}

/** Creates a fresh jury account with a copy of the saved demo state. Returns its credentials. */
export async function createJuryAccount(db: Db): Promise<{ email: string; password: string } | "busy"> {
  if ((await cleanupJuryAccounts(db)) >= MAX_LIVE) return "busy";
  const snap = await loadSnapshot(db);
  const email = juryEmail(randomBytes(4).toString("hex"));
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const uid = data.user.id;

  try {
    // New ids everywhere, references remapped.
    const ids = new Map<string, string>();
    const id = (old: unknown) => {
      const k = String(old);
      if (!ids.has(k)) ids.set(k, randomUUID());
      return ids.get(k)!;
    };
    const ins = async (table: "profiles" | "receipts" | "line_items" | "claims" | "claim_events" | "claim_emails", rows: Row[]) => {
      if (!rows.length) return;
      const { error: e } = await db.from(table).insert(rows as never);
      if (e) throw e;
    };
    await ins("profiles", [{
      ...snap.profile,
      id: uid,
      // Never share the template's Stripe objects (a jury clicking "Résilier" must not cancel anything real).
      stripe_customer_id: null,
      stripe_account_id: null,
    }]);
    await ins("receipts", snap.receipts.map((r) => ({ ...r, id: id(r.id), user_id: uid })));
    await ins("line_items", snap.line_items.map((l) => ({ ...l, id: id(l.id), receipt_id: id(l.receipt_id), ...("user_id" in l ? { user_id: uid } : {}) })));
    await ins("claims", snap.claims.map((c) => ({
      ...c,
      id: id(c.id),
      user_id: uid,
      receipt_id: id(c.receipt_id),
      line_item_id: id(c.line_item_id),
      inbound_alias: c.inbound_alias ? newAlias(randomBytes(4).toString("hex")) : null, // unique per claim
    })));
    await ins("claim_events", snap.claim_events.map((e) => ({ ...e, id: id(e.id), claim_id: id(e.claim_id) })));
    await ins("claim_emails", snap.claim_emails.map((m) => ({
      ...m,
      id: id(m.id),
      claim_id: m.claim_id ? id(m.claim_id) : null,
      provider_message_id: `${m.provider_message_id}#${uid}`, // unique column
    })));
  } catch (e) {
    await db.auth.admin.deleteUser(uid).catch(() => undefined);
    throw e;
  }
  return { email, password };
}
