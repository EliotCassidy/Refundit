// OWNER: Dev 2. Claim submission (ARCHITECTURE.md §4.3, §5).
// Channel order: brand web form via the H agent → email fallback (Gmail) → needs_manual.
// SDK: `hai-agents` (verified against node_modules/hai-agents/dist/index.d.ts v1.3.2).
import "server-only";
import { randomBytes } from "node:crypto";
import { HaiAgentsClient } from "hai-agents";
import { getBrandContact } from "@/lib/brands";
import { transitionClaim } from "@/lib/claims/transition";
import { newAlias, plusAddress } from "@/lib/email/address";
import { emailSendingConfigured, sendEmail } from "@/lib/email/send";
import { env, flags } from "@/lib/shared/env";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { AgentAnswerSchema, ConfirmedProductSchema, type BrandContact, type ClaimRow } from "@/lib/shared/types";
import { buildComplaintText } from "./complaint";
import { buildInstruction } from "./instruction";
import { decideOutcome } from "./outcome";

const MAX_FILE_BYTES = 6_500_000; // H limit: 7 MB total per message

let client: HaiAgentsClient | undefined;
function h() {
  client ??= new HaiAgentsClient({ apiKey: env("HAI_API_KEY") });
  return client;
}

/**
 * Dry run applies to every REAL brand. Our own fictional demo brand (NotCoca, served by this app
 * under /notcoca) is always submitted for real: nobody external receives anything.
 */
function isOwnDemoBrand(contactUrl: string | null | undefined): boolean {
  if (!contactUrl) return false;
  try {
    const u = new URL(contactUrl);
    const own = process.env.APP_URL ? new URL(process.env.APP_URL).host : null;
    return u.pathname.startsWith("/notcoca") && (!own || u.host === own);
  } catch {
    return false;
  }
}

function dryRunFor(contactUrl: string | null | undefined): boolean {
  return flags.agentDryRun() && !isOwnDemoBrand(contactUrl);
}

/** The email given to brands: the claim's Gmail plus address (never the user's real email). */
export function inboundAddress(alias: string, dryRun = flags.agentDryRun()): string {
  const address = plusAddress(alias);
  if (address) return address;
  if (dryRun) return `${alias}@inbound.invalid`; // dry run never sends anything
  throw new Error("GMAIL_USER is required for real (non dry-run) submissions");
}

async function loadReceiptFile(imagePath: string) {
  const { data, error } = await createAdminClient().storage.from("receipts").download(imagePath);
  if (error || !data) return null; // e.g. seed data without a real file
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) return null;
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mediaType = ext === "png" ? "image/png" : ext === "heic" ? "image/heic" : "image/jpeg";
  return { name: `ticket-de-caisse.${ext}`, source: bytes.toString("base64"), type: "base64" as const, mediaType };
}

function userAnswers(claim: ClaimRow): Record<string, string> {
  const raw = claim.user_answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Everything needed to send a claim, whatever the channel. */
async function buildContext(claim: ClaimRow, contactOverride?: BrandContact) {
  const db = createAdminClient();
  const [{ data: item, error: e1 }, { data: receipt, error: e2 }, { data: profile, error: e3 }] = await Promise.all([
    db.from("line_items").select("*").eq("id", claim.line_item_id).single(),
    db.from("receipts").select("*").eq("id", claim.receipt_id).single(),
    db.from("profiles").select("*").eq("id", claim.user_id).maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
  if (!profile) throw new Error("User has no profile (onboarding not completed)");

  // CLAUDE.md rule 8: product identity comes ONLY from confirmed_product.
  const confirmed = ConfirmedProductSchema.safeParse(item.confirmed_product);
  const cp = confirmed.success && confirmed.data.status === "confirmed" ? confirmed.data : null;
  const product = cp
    ? { identified: true, name: cp.quantity && !cp.name.includes(cp.quantity) ? `${cp.name} ${cp.quantity}` : cp.name, brand: cp.brand, ean: cp.ean }
    : { identified: false, name: item.raw_label, brand: null, ean: null };

  // Which brand to CONTACT: registry match (claim.brand_id) or the confirmed brand. This never
  // appears in the complaint text when the product is not identified.
  const brandName = cp?.brand ?? null;
  const contact =
    contactOverride ??
    (claim.brand_id
      ? await getBrandContact({ brandId: claim.brand_id })
      : brandName
        ? await getBrandContact({ brandName })
        : null);

  const alias = claim.inbound_alias ?? newAlias(randomBytes(4).toString("hex"));
  const file = await loadReceiptFile(receipt.image_path);
  const displayBrand = product.identified ? product.brand || contact?.name || null : null;
  const complaintText = buildComplaintText({
    firstName: profile.first_name,
    lastName: profile.last_name,
    productName: product.name,
    productIdentified: product.identified,
    brandName: displayBrand,
    storeName: receipt.store_name,
    purchasedAt: receipt.purchased_at,
    totalPriceCents: item.total_price_cents,
    issueType: claim.issue_type,
    issueDescription: claim.issue_description,
    hasReceiptAttachment: Boolean(file),
    extraDetails: userAnswers(claim),
    reference: alias,
  });
  return { item, receipt, profile, contact, alias, file, product, displayBrand, complaintText };
}
type ClaimContext = Awaited<ReturnType<typeof buildContext>>;

/**
 * Email channel. The claim must currently be 'submitting'; ends in 'submitted' or 'needs_manual'.
 * In dry run nothing is sent: the claim is marked submitted + dry_run, like the web form.
 */
async function submitByEmail(claim: ClaimRow, ctx: ClaimContext, extra: Record<string, unknown> = {}) {
  const to = ctx.contact!.contactEmail!;
  const dryRun = flags.agentDryRun();

  if (dryRun) {
    await transitionClaim(claim.id, "submitted", {
      patch: { submission_channel: "email", dry_run: true, failure_reason: null },
      payload: { ...extra, channel: "email", to, dry_run: true },
    });
    return "submitted" as const;
  }
  if (!emailSendingConfigured()) {
    const reason = `email_not_configured: send manually to ${to}`;
    await transitionClaim(claim.id, "needs_manual", { patch: { failure_reason: reason }, payload: { ...extra, channel: "email", to } });
    return "needs_manual" as const;
  }
  try {
    const { id } = await sendEmail({
      to,
      fromName: `${ctx.profile.first_name} ${ctx.profile.last_name}`,
      alias: ctx.alias,
      subject: `${ctx.product.identified ? `Réclamation produit : ${ctx.product.name}` : "Réclamation produit"} [${ctx.alias}]`,
      text: ctx.complaintText,
      attachment: ctx.file ? { filename: ctx.file.name, base64: ctx.file.source, contentType: ctx.file.mediaType } : null,
    });
    await transitionClaim(claim.id, "submitted", {
      patch: { submission_channel: "email", dry_run: false, failure_reason: null },
      payload: { ...extra, channel: "email", to, email_id: id },
    });
    return "submitted" as const;
  } catch (err) {
    const reason = `email_failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    await transitionClaim(claim.id, "agent_failed", { patch: { failure_reason: reason }, payload: { ...extra, channel: "email", to } });
    return "agent_failed" as const;
  }
}

export type SubmitResult = { status: ClaimRow["status"]; agentViewUrl: string | null; reason?: string };

/** Full submission flow. Caller must have checked canTransition(claim.status, "submitting"). */
export async function submitClaim(claim: ClaimRow): Promise<SubmitResult> {
  const ctx = await buildContext(claim);
  const dryRun = dryRunFor(ctx.contact?.contactUrl);

  // Lock the claim first (compare-and-set), so a double click can't start two agents.
  await transitionClaim(claim.id, "submitting", {
    payload: { attempt: claim.attempt + 1, dry_run: dryRun },
    patch: {
      attempt: claim.attempt + 1,
      inbound_alias: ctx.alias,
      complaint_text: ctx.complaintText,
      brand_id: ctx.contact?.brandId || claim.brand_id,
      dry_run: dryRun,
      submission_channel: null,
      missing_fields: [],
      failure_reason: null,
      confirmation_number: null,
      h_session_id: null,
      h_agent_view_url: null,
    },
  });

  if (!ctx.contact?.contactUrl) {
    if (ctx.contact?.contactEmail) {
      const status = await submitByEmail(claim, ctx, { reason: "no_contact_form" });
      return { status, agentViewUrl: null };
    }
    const reason = "no_contact_form: brand unknown, no contact form or email found";
    await transitionClaim(claim.id, "needs_manual", { patch: { failure_reason: reason } });
    return { status: "needs_manual", agentViewUrl: null, reason };
  }

  try {
    const instruction = buildInstruction({
      contactUrl: ctx.contact.contactUrl,
      agentHints: ctx.contact.agentHints,
      dryRun,
      customer: {
        firstName: ctx.profile.first_name,
        lastName: ctx.profile.last_name,
        addressLine1: ctx.profile.address_line1,
        addressLine2: ctx.profile.address_line2,
        postalCode: ctx.profile.postal_code,
        city: ctx.profile.city,
        country: ctx.profile.country === "FR" ? "France" : ctx.profile.country,
        phone: ctx.profile.phone,
        email: inboundAddress(ctx.alias),
      },
      product: {
        identified: ctx.product.identified,
        name: ctx.product.name,
        brand: ctx.displayBrand,
        ean: ctx.product.ean,
        purchasedAt: ctx.receipt.purchased_at,
        storeName: ctx.receipt.store_name,
        priceCents: ctx.item.total_price_cents,
      },
      complaintText: ctx.complaintText,
      userAnswers: userAnswers(claim),
      receiptFileName: ctx.file?.name ?? null,
    });

    const session = await h().startSession({
      agent: process.env.AGENT_ID || "h/web-surfer-flash",
      messages: { type: "user_message", message: instruction, files: ctx.file ? [ctx.file] : undefined },
      answerSchema: AgentAnswerSchema,
      overrides: { "agent.environments[kind=web].start_url": ctx.contact.contactUrl },
      maxSteps: 60,
      maxTimeS: 600,
      timezone: "Europe/Paris",
      idleTimeoutS: null, // end as soon as the agent answers (we observed "idle" otherwise)
      idempotencyKey: `claim-${claim.id}-${claim.attempt + 1}`,
    });
    const details = await session.get();
    const agentViewUrl = details.agentViewUrl ?? null;

    await createAdminClient()
      .from("claims")
      .update({ h_session_id: session.id, h_agent_view_url: agentViewUrl, submission_channel: "web_form" })
      .eq("id", claim.id);

    return { status: "submitting", agentViewUrl };
  } catch (err) {
    const reason = `start_failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    if (ctx.contact.contactEmail) {
      const status = await submitByEmail(claim, ctx, { reason });
      return { status, agentViewUrl: null };
    }
    await transitionClaim(claim.id, "agent_failed", { patch: { failure_reason: reason } });
    return { status: "agent_failed", agentViewUrl: null, reason };
  }
}

/**
 * Pulls the H session state and applies the outcome if terminal. If the agent was blocked
 * (captcha, login, no form…) and the brand has a support email, falls back to email.
 * Idempotent and safe to call from both /sync and the webhook.
 */
export async function syncClaim(claim: ClaimRow): Promise<ClaimRow["status"]> {
  if (claim.status !== "submitting" || !claim.h_session_id) return claim.status;

  const status = await h().sessions.getSessionStatus({ id: claim.h_session_id });
  const isFinal = ["completed", "failed", "timed_out", "interrupted", "idle"].includes(status.status);
  if (!isFinal) return claim.status;

  const session = await h().sessions.getSession({ id: claim.h_session_id });
  if (status.status === "idle") {
    // The agent answered but keeps the session open: close it to free a concurrency slot.
    await h().session(claim.h_session_id).cancel().catch(() => undefined);
  }
  const decision = decideOutcome(
    { status: status.status, errorCode: status.errorCode, error: status.error, outcome: status.outcome, latestAnswer: session.latestAnswer },
    claim.dry_run,
  );
  if (!decision) return claim.status;

  try {
    if (decision.to === "needs_manual" && claim.brand_id) {
      const contact = await getBrandContact({ brandId: claim.brand_id });
      if (contact.contactEmail) {
        // Re-check the status right before sending, so a concurrent sync can't send twice.
        const { data: fresh } = await createAdminClient().from("claims").select("*").eq("id", claim.id).single();
        if (fresh?.status !== "submitting") return fresh?.status ?? claim.status;
        const ctx = await buildContext(fresh, contact);
        return await submitByEmail(fresh, ctx, { agent_blocked: decision.patch.failure_reason, ...decision.payload });
      }
    }
    const updated = await transitionClaim(claim.id, decision.to, { patch: decision.patch, payload: decision.payload });
    return updated.status;
  } catch {
    // Already moved by a concurrent sync/webhook: re-read.
    const { data } = await createAdminClient().from("claims").select("status").eq("id", claim.id).single();
    return data?.status ?? claim.status;
  }
}

/** Stops the running H session (best effort). The caller then transitions to cancelled. */
export async function cancelClaimSession(claim: ClaimRow): Promise<void> {
  if (!claim.h_session_id || claim.h_session_id.startsWith("mock-")) return;
  try {
    await h().session(claim.h_session_id).cancel();
  } catch {
    // Session already finished: nothing to stop.
  }
}
