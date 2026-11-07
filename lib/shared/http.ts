// Small helpers so every route returns the same error shape (API_CONTRACTS §5).
import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { ApiError } from "./types";

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
}

export const notImplemented = (what: string) => apiError(501, "not_implemented", `${what} is not implemented yet`);

/** True if the request carries a valid x-internal-key (server-to-server calls). */
export function hasInternalKey(request: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  const got = request.headers.get("x-internal-key");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
