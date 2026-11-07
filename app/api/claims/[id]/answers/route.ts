// OWNER: Dev 2. POST /api/claims/:id/answers — the user answers the fields the brand's form
// required (claims.missing_fields). Once every field is answered, the claim is resubmitted.
import type { NextRequest } from "next/server";
import { submitClaim } from "@/lib/agent";
import { sendEmail } from "@/lib/email/send";
import { transitionClaim } from "@/lib/claims/transition";
import { mockSubmit } from "@/lib/agent/mock";
import { loadClaimForRequest } from "@/lib/claims/access";
import { flags } from "@/lib/shared/env";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { ClaimAnswersBodySchema } from "@/lib/shared/types";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/answers">) {
  const { id } = await ctx.params;
  const loaded = await loadClaimForRequest(request, id);
  if ("response" in loaded) return loaded.response;
  const { claim } = loaded;

  if (claim.status !== "waiting_input") {
    return apiError(409, "invalid_status", `No information is requested for a claim in status ${claim.status}`);
  }
  const parsed = ClaimAnswersBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.message);

  // Only keep answers to fields that were actually requested.
  const requested = new Set(claim.missing_fields);
  const previous = (claim.user_answers && typeof claim.user_answers === "object" && !Array.isArray(claim.user_answers)
    ? claim.user_answers
    : {}) as Record<string, string>;
  const answers = { ...previous };
  for (const [field, value] of Object.entries(parsed.data.answers)) {
    if (requested.has(field)) answers[field] = value;
  }
  const remaining = claim.missing_fields.filter((f) => !answers[f]);

  const db = createAdminClient();
  const { data: updated, error } = await db
    .from("claims")
    .update({ user_answers: answers })
    .eq("id", claim.id)
    .eq("status", "waiting_input")
    .select("*")
    .single();
  if (error) return apiError(500, "db_error", error.message);

  if (remaining.length) return Response.json({ status: "waiting_input", remaining });

  // If the BRAND asked for these details by email, answer that email instead of refiling the form.
  const { data: askEvent } = await db
    .from("claim_events")
    .select("payload")
    .eq("claim_id", claim.id)
    .eq("to_status", "waiting_input")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const askedByEmail = (askEvent?.payload as { source?: string } | null)?.source === "email";
  if (askedByEmail) {
    const { data: brandEmail } = await db
      .from("claim_emails")
      .select("*")
      .eq("claim_id", claim.id)
      .eq("classification", "waiting_input")
      .order("received_at", { ascending: false })
      .limit(1)
      .single();
    const { data: profile } = await db.from("profiles").select("first_name, last_name").eq("id", claim.user_id).single();
    try {
      const name = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
      const { id: emailId } = await sendEmail({
        to: brandEmail!.from_address,
        fromName: name,
        alias: claim.inbound_alias!,
        subject: brandEmail!.subject?.startsWith("Re:") ? brandEmail!.subject : `Re: ${brandEmail!.subject ?? "Réclamation"}`,
        text: [
          "Bonjour,",
          "",
          "Voici les informations demandées :",
          ...Object.entries(answers).map(([k, v]) => `${k} : ${v}`),
          "",
          "Cordialement,",
          name,
          "",
          `Référence de ma demande : ${claim.inbound_alias}`,
        ].join("\n"),
        inReplyTo: brandEmail!.provider_message_id,
      });
      await transitionClaim(claim.id, "submitted", { payload: { channel: "email", reply_to_brand: emailId } });
      return Response.json({ status: "submitted" });
    } catch (err) {
      console.error("[answers:email]", err);
      return apiError(502, "email_failed", err instanceof Error ? err.message : "Unknown error");
    }
  }

  try {
    if (flags.agentMock()) {
      await mockSubmit(updated);
      return Response.json({ status: "submitting", agentViewUrl: null }, { status: 202 });
    }
    const result = await submitClaim(updated);
    return Response.json(
      { status: result.status, agentViewUrl: result.agentViewUrl, reason: result.reason ?? null },
      { status: result.status === "submitting" ? 202 : 200 },
    );
  } catch (err) {
    console.error("[answers]", err);
    return apiError(500, "submit_failed", err instanceof Error ? err.message : "Unknown error");
  }
}
