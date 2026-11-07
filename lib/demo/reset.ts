// OWNER: Dev 2. Jury demo: snapshot of the demo account (profile, receipts, line items, claims, events, emails)
// and a reset that puts it back exactly as saved. Everything created during a demo run is deleted
// (and the NotCoca requests it produced), saved rows are restored as they were.
// The snapshot is DB data (emails, complaint texts…): it lives in the private "receipts" Storage bucket,
// never in the git repository.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plusAddress } from "@/lib/email/address";
import type { Database } from "@/lib/shared/database.types";
import { DEMO_EMAIL } from "./config";

type Db = SupabaseClient<Database>;
type Row = Record<string, unknown> & { id: string };
export type DemoSnapshot = {
  saved_at: string;
  user_id: string;
  profile: Row;
  receipts: Row[];
  line_items: Row[];
  claims: Row[];
  claim_events: Row[];
  claim_emails: Row[];
};

export async function demoUserId(db: Db): Promise<string> {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
    if (user) return user.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`${DEMO_EMAIL} not found`);
}

const must = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function takeSnapshot(db: Db): Promise<DemoSnapshot> {
  const userId = await demoUserId(db);
  const profile = must(await db.from("profiles").select("*").eq("id", userId).single()) as unknown as Row;
  const receipts = must(await db.from("receipts").select("*").eq("user_id", userId)) as unknown as Row[];
  const claims = must(await db.from("claims").select("*").eq("user_id", userId)) as unknown as Row[];
  const receiptIds = receipts.map((r) => r.id);
  const claimIds = claims.map((c) => c.id);
  const line_items = receiptIds.length ? (must(await db.from("line_items").select("*").in("receipt_id", receiptIds)) as unknown as Row[]) : [];
  const claim_events = claimIds.length ? (must(await db.from("claim_events").select("*").in("claim_id", claimIds)) as unknown as Row[]) : [];
  const claim_emails = claimIds.length ? (must(await db.from("claim_emails").select("*").in("claim_id", claimIds)) as unknown as Row[]) : [];
  return { saved_at: new Date().toISOString(), user_id: userId, profile, receipts, line_items, claims, claim_events, claim_emails };
}

/** Puts the demo account back to the snapshot. Returns what was removed. */
export async function resetDemoAccount(db: Db, snap: DemoSnapshot): Promise<{ claims: number; receipts: number }> {
  const userId = snap.user_id;
  const keep = (rows: Row[]) => new Set(rows.map((r) => r.id));
  const keptClaims = keep(snap.claims);
  const keptReceipts = keep(snap.receipts);

  const claims = must(await db.from("claims").select("id, inbound_alias").eq("user_id", userId));
  const extraClaims = claims.filter((c) => !keptClaims.has(c.id));
  const receipts = must(await db.from("receipts").select("id").eq("user_id", userId));
  const extraReceipts = receipts.filter((r) => !keptReceipts.has(r.id)).map((r) => r.id);
  const allClaimIds = claims.map((c) => c.id);

  // 1) Children of every demo claim (restored below for the saved ones), then the new claims and receipts.
  if (allClaimIds.length) {
    must(await db.from("claim_events").delete().in("claim_id", allClaimIds).select("id"));
    must(await db.from("claim_emails").delete().in("claim_id", allClaimIds).select("id"));
  }
  if (extraClaims.length) must(await db.from("claims").delete().in("id", extraClaims.map((c) => c.id)).select("id"));
  if (extraReceipts.length) {
    must(await db.from("line_items").delete().in("receipt_id", extraReceipts).select("id"));
    must(await db.from("receipts").delete().in("id", extraReceipts).select("id"));
  }
  // NotCoca back-office requests sent by the deleted claims (their email is the claim's plus address).
  const emails = extraClaims.map((c) => (c.inbound_alias ? plusAddress(c.inbound_alias) : null)).filter((e): e is string => Boolean(e));
  if (emails.length) must(await db.from("notcoca_requests").delete().in("email", emails).select("id"));

  // 2) Saved rows back as they were (parents first).
  const up = async (table: "profiles" | "receipts" | "line_items" | "claims" | "claim_events" | "claim_emails", rows: Row[]) => {
    if (rows.length) must(await db.from(table).upsert(rows as never).select("id"));
  };
  await up("profiles", [snap.profile]);
  await up("receipts", snap.receipts);
  await up("line_items", snap.line_items);
  await up("claims", snap.claims);
  await up("claim_events", snap.claim_events);
  await up("claim_emails", snap.claim_emails);
  return { claims: extraClaims.length, receipts: extraReceipts.length };
}

const BUCKET = "receipts";
const PATH = "_demo/snapshot.json";

export async function saveSnapshot(db: Db, snap: DemoSnapshot): Promise<void> {
  const body = new Blob([JSON.stringify(snap)], { type: "application/json" });
  const { error } = await db.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

export async function loadSnapshot(db: Db): Promise<DemoSnapshot> {
  const { data, error } = await db.storage.from(BUCKET).download(PATH);
  if (error || !data) throw error ?? new Error("demo snapshot missing: run `npm run demo -- snapshot`");
  return JSON.parse(await data.text()) as DemoSnapshot;
}
