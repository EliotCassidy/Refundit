// OWNER: Dev 2. Real H Company agent integration (ARCHITECTURE.md §4.3, §5).
// SDK: `hai-agents` (verified against node_modules/hai-agents/dist/index.d.ts v1.3.2).
import "server-only";
import { randomBytes } from "node:crypto";
import { HaiAgentsClient } from "hai-agents";
import { getBrandContact } from "@/lib/brands";
import { transitionClaim } from "@/lib/claims/transition";
import { env, flags } from "@/lib/shared/env";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { AgentAnswerSchema, type ClaimRow } from "@/lib/shared/types";
import { buildComplaintText } from "./complaint";
import { buildInstruction } from "./instruction";
import { decideOutcome } from "./outcome";

const MAX_FILE_BYTES = 6_500_000; // H limit: 7 MB total per message

let client: HaiAgentsClient | undefined;
function h() {
  client ??= new HaiAgentsClient({ apiKey: env("HAI_API_KEY") });
  return client;
}

export function inboundAddress(alias: string): string {
  const domain = process.env.INBOUND_DOMAIN;
  if (domain) return `${alias}@${domain}`;
  if (flags.agentDryRun()) return `${alias}@inbound.invalid`; // dry run never sends the form
  throw new Error("INBOUND_DOMAIN is required for real (non dry-run) submissions");
}

async function loadContext(claim: ClaimRow) {
  const db = createAdminClient();
  const [{ data: item, error: e1 }, { data: receipt, error: e2 }, { data: profile, error: e3 }] = await Promise.all([
    db.from("line_items").select("*").eq("id", claim.line_item_id).single(),
    db.from("receipts").select("*").eq("id", claim.receipt_id).single(),
    db.from("profiles").select("*").eq("id", claim.user_id).maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
  if (!profile) throw new Error("User has no profile (onboarding not completed)");
  return { item, receipt, profile };
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

export type SubmitResult = { status: ClaimRow["status"]; agentViewUrl: string | null; reason?: string };

/** Full submission flow. Caller must have checked canTransition(claim.status, "submitting"). */
export async function submitClaim(claim: ClaimRow): Promise<SubmitResult> {
  const { item, receipt, profile } = await loadContext(claim);
  const dryRun = flags.agentDryRun();

  const brandName = item.brand_name_guess;
  const contact = claim.brand_id
    ? await getBrandContact({ brandId: claim.brand_id })
    : brandName
      ? await getBrandContact({ brandName })
      : null;

  const alias = claim.inbound_alias ?? `claim-${randomBytes(4).toString("hex")}`;
  const file = await loadReceiptFile(receipt.image_path);
  const complaintText = buildComplaintText({
    firstName: profile.first_name,
    lastName: profile.last_name,
    productName: item.product_name,
    brandName: contact?.name || brandName,
    storeName: receipt.store_name,
    purchasedAt: receipt.purchased_at,
    totalPriceCents: item.total_price_cents,
    issueType: claim.issue_type,
    issueDescription: claim.issue_description,
    hasReceiptAttachment: Boolean(file),
  });

  // Lock the claim first (compare-and-set), so a double click can't start two agents.
  await transitionClaim(claim.id, "submitting", {
    payload: { attempt: claim.attempt + 1, dry_run: dryRun },
    patch: {
      attempt: claim.attempt + 1,
      inbound_alias: alias,
      complaint_text: complaintText,
      brand_id: contact?.brandId || claim.brand_id,
      dry_run: dryRun,
      failure_reason: null,
      confirmation_number: null,
      h_session_id: null,
      h_agent_view_url: null,
    },
  });

  if (!contact?.contactUrl) {
    const reason = "no_contact_form: brand unknown or without contact URL";
    await transitionClaim(claim.id, "needs_manual", { patch: { failure_reason: reason } });
    return { status: "needs_manual", agentViewUrl: null, reason };
  }

  try {
    const instruction = buildInstruction({
      contactUrl: contact.contactUrl,
      agentHints: contact.agentHints,
      dryRun,
      customer: {
        firstName: profile.first_name,
        lastName: profile.last_name,
        addressLine1: profile.address_line1,
        addressLine2: profile.address_line2,
        postalCode: profile.postal_code,
        city: profile.city,
        country: profile.country === "FR" ? "France" : profile.country,
        phone: profile.phone,
        email: inboundAddress(alias),
      },
      product: {
        name: item.product_name,
        brand: contact.name || brandName,
        ean: item.ean,
        purchasedAt: receipt.purchased_at,
        storeName: receipt.store_name,
        priceCents: item.total_price_cents,
      },
      complaintText,
      receiptFileName: file?.name ?? null,
    });

    const session = await h().startSession({
      agent: process.env.AGENT_ID || "h/web-surfer-flash",
      messages: { type: "user_message", message: instruction, files: file ? [file] : undefined },
      answerSchema: AgentAnswerSchema,
      overrides: { "agent.environments[kind=web].start_url": contact.contactUrl },
      maxSteps: 60,
      maxTimeS: 600,
      timezone: "Europe/Paris",
      idempotencyKey: `claim-${claim.id}-${claim.attempt + 1}`,
    });
    const details = await session.get();
    const agentViewUrl = details.agentViewUrl ?? null;

    await createAdminClient()
      .from("claims")
      .update({ h_session_id: session.id, h_agent_view_url: agentViewUrl })
      .eq("id", claim.id);

    return { status: "submitting", agentViewUrl };
  } catch (err) {
    const reason = `start_failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    await transitionClaim(claim.id, "agent_failed", { patch: { failure_reason: reason } });
    return { status: "agent_failed", agentViewUrl: null, reason };
  }
}

/**
 * Pulls the H session state and applies the outcome if terminal. Idempotent and safe to call
 * from both /sync and the webhook: the compare-and-set in transitionClaim drops duplicates.
 */
export async function syncClaim(claim: ClaimRow): Promise<ClaimRow["status"]> {
  if (claim.status !== "submitting" || !claim.h_session_id) return claim.status;

  const status = await h().sessions.getSessionStatus({ id: claim.h_session_id });
  const isTerminal = ["completed", "failed", "timed_out", "interrupted"].includes(status.status);
  if (!isTerminal) return claim.status;

  const session = await h().sessions.getSession({ id: claim.h_session_id });
  const decision = decideOutcome(
    { status: status.status, errorCode: status.errorCode, error: status.error, outcome: status.outcome, latestAnswer: session.latestAnswer },
    claim.dry_run,
  );
  if (!decision) return claim.status;

  try {
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
