// Non-DB contracts shared by both devs. Source of truth: API_CONTRACTS.md §3.
// Changing anything here means updating API_CONTRACTS.md in the same commit.
import { z } from "zod";
import type { Tables } from "./database.types";

export type ProfileRow = Tables<"profiles">;
export type BrandRow = Tables<"brands">;
export type ReceiptRow = Tables<"receipts">;
export type LineItemRow = Tables<"line_items">;
export type ClaimRow = Tables<"claims">;
export type ClaimEventRow = Tables<"claim_events">;
export type ClaimEmailRow = Tables<"claim_emails">;

// ---- Issues ----
export const ISSUE_TYPES = [
  "damaged", "missing_quantity", "expired", "quality", "foreign_object", "flat_drink", "other",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS_FR: Record<IssueType, string> = {
  damaged: "Produit abîmé / écrasé",
  missing_quantity: "Quantité manquante",
  expired: "Date de consommation dépassée",
  quality: "Goût ou texture anormale",
  foreign_object: "Corps étranger",
  flat_drink: "Boisson sans gaz",
  other: "Autre problème",
};

// ---- Claims ----
export const CLAIM_STATUSES = [
  "draft", "submitting", "submitted", "waiting_input", "accepted", "refused",
  "agent_failed", "needs_manual", "cancelled",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS_FR: Record<ClaimStatus, string> = {
  draft: "Brouillon",
  submitting: "Envoi en cours",
  submitted: "Envoyée",
  waiting_input: "Infos demandées",
  accepted: "Acceptée",
  refused: "Refusée",
  agent_failed: "Échec de l'agent",
  needs_manual: "Action manuelle requise",
  cancelled: "Annulée",
};

export const SUBMISSION_CHANNELS = ["web_form", "email"] as const;
export type SubmissionChannel = (typeof SUBMISSION_CHANNELS)[number];

// ---- Receipt parser output (Dev 1 produces) ----
export const ParsedReceiptSchema = z.object({
  store_name: z.string().nullable(),
  purchased_at: z.string().nullable(), // ISO 8601
  currency: z.literal("EUR"),
  total_cents: z.number().int().nullable(),
  items: z.array(
    z.object({
      raw_label: z.string(),
      product_name: z.string(),
      brand_guess: z.string().nullable(),
      quantity: z.number().positive(),
      unit_price_cents: z.number().int().nullable(),
      total_price_cents: z.number().int(),
    }),
  ),
});
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

// ---- H agent structured answer (Dev 2) ----
export const AGENT_BLOCKERS = [
  "captcha", "login_required", "no_contact_form", "missing_info", "upload_failed", "site_error", "other",
] as const;
export type AgentBlocker = (typeof AGENT_BLOCKERS)[number];

export const AgentAnswerSchema = z.object({
  submitted: z.boolean(),
  confirmation_number: z.string().nullable(),
  form_url: z.string().nullable(),
  blocker: z.enum(AGENT_BLOCKERS).nullable(),
  notes: z.string(),
});
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

// ---- Brand contact (Dev 1 provides via lib/brands, Dev 2 consumes) ----
export type BrandContact = {
  brandId: string;
  name: string;
  contactUrl: string | null; // web form → H agent
  contactEmail: string | null; // fallback when no form / agent blocked → email via Resend
  agentHints: string | null;
  requiresReceiptUpload: boolean;
  verified: boolean;
};

// ---- HTTP payloads ----
export const CreateClaimsBodySchema = z.object({
  receiptId: z.uuid(),
  items: z
    .array(
      z.object({
        lineItemId: z.uuid(),
        issueType: z.enum(ISSUE_TYPES),
        issueDescription: z.string().max(2000).optional(),
        issuePhotoPath: z.string().optional(),
      }),
    )
    .min(1),
});
export type CreateClaimsBody = z.infer<typeof CreateClaimsBodySchema>;

export type ApiError = { error: { code: string; message: string } };
