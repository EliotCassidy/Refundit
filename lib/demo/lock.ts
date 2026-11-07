// OWNER: Dev 2. One jury at a time on the demo account: a small lock in the private Storage bucket
// (receipts/_demo/lock.json = { session, at }). The open demo tab renews it every 30 s (heartbeat);
// a lock without news for 2 minutes is free again (tab closed).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/shared/database.types";

type Db = SupabaseClient<Database>;
type Lock = { session: string; at: string };
const BUCKET = "receipts";
const PATH = "_demo/lock.json";
export const LOCK_TTL_MS = 120_000;

async function read(db: Db): Promise<Lock | null> {
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return null;
  try {
    return JSON.parse(await data.text()) as Lock;
  } catch {
    return null;
  }
}

async function write(db: Db, session: string) {
  const body = new Blob([JSON.stringify({ session, at: new Date().toISOString() })], { type: "application/json" });
  const { error } = await db.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

const fresh = (l: Lock | null) => Boolean(l && Date.now() - new Date(l.at).getTime() < LOCK_TTL_MS);

/** Takes (or renews) the lock for this session. false = another jury holds it (force = take it anyway,
 *  e.g. the other jury closed their tab: their next heartbeat gets 409 and their tour stops). */
export async function acquireDemoLock(db: Db, session: string, force = false): Promise<boolean> {
  const cur = await read(db);
  if (!force && cur && cur.session !== session && fresh(cur)) return false;
  await write(db, session);
  return true;
}

export async function releaseDemoLock(db: Db, session: string): Promise<void> {
  const cur = await read(db);
  if (cur?.session === session) await db.storage.from(BUCKET).remove([PATH]);
}
