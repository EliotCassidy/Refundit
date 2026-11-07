// OWNER: Dev 2. POST /api/email/poll — reads brand replies from the Gmail inbox (IMAP).
// Called by the dashboard when it opens (Gmail has no webhook). Throttled to once a minute
// per server instance. Signed-in user or x-internal-key.
import { pollInbox } from "@/lib/email/inbox";
import { apiError, hasInternalKey } from "@/lib/shared/http";
import { getUser } from "@/lib/shared/supabase/server";

export const maxDuration = 60;

const MIN_INTERVAL_MS = 60_000;
let lastPoll = 0;
let running: Promise<unknown> | null = null;

export async function POST(request: Request) {
  if (!hasInternalKey(request) && !(await getUser())) {
    return apiError(401, "unauthenticated", "Sign in required");
  }
  if (running || Date.now() - lastPoll < MIN_INTERVAL_MS) {
    return Response.json({ skipped: "throttled" });
  }
  lastPoll = Date.now();
  try {
    running = pollInbox();
    const result = await running;
    return Response.json(result);
  } catch (err) {
    console.error("[email/poll]", err);
    return apiError(502, "poll_failed", err instanceof Error ? err.message : "Unknown error");
  } finally {
    running = null;
  }
}
