// OWNER: Dev 2. H Company webhook (ARCHITECTURE.md §4.4).
// Registered once per org: POST https://agp.eu.hcompany.ai/api/v2/webhooks with
// enabled_events ["session.completed","session.failed","session.timed_out"]; the returned
// `secret` (whsec_…, shown once) goes in H_WEBHOOK_SECRET.
// Idempotency: at-least-once deliveries are harmless because syncClaim only acts on
// claims still in 'submitting' and transitions are compare-and-set.
import { verifyWebhook, WebhookVerificationError } from "hai-agents";
import { syncClaim } from "@/lib/agent";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.H_WEBHOOK_SECRET;
  if (!secret) return apiError(500, "not_configured", "H_WEBHOOK_SECRET is not set");

  const rawBody = await request.text(); // raw body BEFORE parsing, required for the signature
  let event;
  try {
    event = verifyWebhook(
      rawBody,
      request.headers.get("x-h-webhook-signature") ?? "",
      request.headers.get("x-h-webhook-timestamp") ?? "",
      secret.split(","), // comma-separated during a secret rotation
    );
  } catch (err) {
    if (err instanceof WebhookVerificationError) return apiError(401, "invalid_signature", "Invalid signature");
    throw err;
  }

  const sessionId = typeof event.data.session_id === "string" ? event.data.session_id : null;
  if (!sessionId) return Response.json({ ok: true, ignored: "no session_id" });

  const { data: claim } = await createAdminClient()
    .from("claims")
    .select("*")
    .eq("h_session_id", sessionId)
    .maybeSingle();
  // Sessions not created by Refundit (e.g. manual spikes) are acknowledged and ignored.
  if (!claim) return Response.json({ ok: true, ignored: "unknown session" });

  try {
    const status = await syncClaim(claim);
    return Response.json({ ok: true, status });
  } catch (err) {
    console.error("[webhook:h]", err);
    // 5xx → H retries later (up to ~24h).
    return apiError(502, "sync_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
