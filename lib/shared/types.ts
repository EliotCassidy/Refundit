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

// ---- Product identification, step 2 (Dev 1 produces; API_CONTRACTS §3) ----
// catalog = the brand's own catalog: only our fictional demo brand NotCoca (absent from Open Food Facts, fictional EANs).
export const PRODUCT_SOURCES = ["off", "obf", "linkup", "confirmed_match", "catalog"] as const;

/** A real product for a receipt line. Every field comes from a product database (or, source "linkup", from the web
 *  page where its EAN is written when OFF doesn't have it), never from our LLM's guess. */
export const ProductSchema = z.object({
  ean: z.string(), // check digit verified
  brand: z.string().nullable(),
  name: z.string(),
  quantity: z.string().nullable(), // e.g. "175 g"
  image_url: z.string().nullable(),
  source: z.enum(PRODUCT_SOURCES),
});
export type Product = z.infer<typeof ProductSchema>;

/**
 * line_items.confirmed_product. NULL until the user validates. The ONLY product field the claim agent may trust.
 * "confirmed" = a product from a database (source off/obf/linkup/confirmed_match, EAN verified)
 *   OR typed by the user when nothing matched (source "user", ean null): facts the user provided (rule 1).
 */
export const ConfirmedProductSchema = z.discriminatedUnion("status", [
  ProductSchema.extend({
    status: z.literal("confirmed"),
    ean: z.string().nullable(), // null only when source = "user"
    source: z.enum([...PRODUCT_SOURCES, "user"]),
  }),
  z.object({ status: z.literal("not_found") }), // the user said none of the candidates is their product
]);
export type ConfirmedProduct = z.infer<typeof ConfirmedProductSchema>;

/** line_items.product_candidates: what /identify found. Display only. */
export const ProductCandidatesSchema = z.object({
  llm_guess: z.string().nullable(), // the LLM's expansion of the abbreviated label: a hint, NEVER a result
  candidates: z
    .array(
      ProductSchema.extend({
        score: z.number(),
        reference_price_cents: z.number().int().nullable(), // Open Prices median
        reasons: z.array(z.string()), // why it ranks there (French, shown to the user)
      }),
    )
    .max(5),
  uncertain: z.boolean(),
  uncertain_reasons: z.array(z.string()),
  // true = the 1st is right in ≥ 90% of cases on our eval (score ≥ 90, or ≥ 60 with 20 points ahead of the 2nd,
  // or a barcode typed by the user): the page validates it directly (the user can still change it).
  confident: z.boolean().default(false),
  searched_at: z.string(), // ISO 8601
});
export type ProductCandidates = z.infer<typeof ProductCandidatesSchema>;

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
  // Self-checks, verified in code (lib/agent/outcome.ts), because prompts alone were not enough:
  customer_email_entered: z.boolean(), // the customer's email was typed into the form
  submit_button_found: z.boolean(), // the button that actually SENDS the request was found
  guessed_fields: z.array(z.string()), // fields filled with a value NOT provided (must be empty)
  missing_fields: z.array(z.string()), // labels (as on the form) of REQUIRED fields we have no data for
  notes: z.string(),
});
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

// ---- Brand contact (Dev 1 provides via lib/brands, Dev 2 consumes) ----
export type BrandContact = {
  brandId: string;
  name: string;
  contactUrl: string | null; // web form → H agent
  contactEmail: string | null; // fallback when no form / agent blocked → email via Gmail
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

// POST /api/claims/:id/answers: the user's answers to claims.missing_fields (Dev 2).
export const ClaimAnswersBodySchema = z.object({
  answers: z.record(z.string(), z.string().trim().min(1).max(500)),
});
export type ClaimAnswersBody = z.infer<typeof ClaimAnswersBodySchema>;

export type ApiError = { error: { code: string; message: string } };
