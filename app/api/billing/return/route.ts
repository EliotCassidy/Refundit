// OWNER: Dev 2. GET /api/billing/return?session_id=… — Stripe Checkout success URL. Reads the
// subscription right away (no dependency on the webhook, which can't reach localhost) and
// redirects to /billing.
import type { NextRequest } from "next/server";
import { applySubscription } from "@/lib/billing";
import { getUser } from "@/lib/shared/supabase/server";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const back = new URL("/billing", request.url);
  const user = await getUser();
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!user || !sessionId) return Response.redirect(back, 303);
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.client_reference_id === user.id && session.subscription && typeof session.subscription !== "string") {
      await applySubscription(session.subscription);
      back.searchParams.set("status", "success");
    }
  } catch (err) {
    console.error("[billing:return]", err);
    back.searchParams.set("status", "error");
  }
  return Response.redirect(back, 303);
}
