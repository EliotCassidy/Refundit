// OWNER: Dev 2. NotCoca admin access: a shared key (NOTCOCA_ADMIN_KEY) stored as a hashed cookie.
// Demo-level protection only.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "notcoca_admin";

export const hashKey = (key: string) => createHash("sha256").update(`notcoca:${key}`).digest("hex");

export function checkKey(candidate: string): boolean {
  const key = process.env.NOTCOCA_ADMIN_KEY;
  if (!key || !candidate) return false;
  const a = Buffer.from(hashKey(key));
  const b = Buffer.from(hashKey(candidate));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const key = process.env.NOTCOCA_ADMIN_KEY;
  if (!key) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value === hashKey(key);
}
