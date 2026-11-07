// OWNER: Dev 2. H Company webhook (ARCHITECTURE.md §4.4).
// TODO(dev2): verify X-H-Webhook-Signature = "sha256=" + HMAC-SHA256(H_WEBHOOK_SECRET, `${timestamp}.${rawBody}`),
// dedupe on X-H-Webhook-Delivery, find the claim by h_session_id, fetch the session, map the outcome.
// Read the raw body with `await request.text()` BEFORE parsing JSON (needed for the signature).
import { notImplemented } from "@/lib/shared/http";

export async function POST() {
  return notImplemented("H webhook");
}
