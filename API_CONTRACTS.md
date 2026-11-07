# API contracts

This is the source of truth for everything both devs depend on. Change it only in a commit that updates this file **and** the code, and tell the other dev.

## 1. Enums

```sql
create type receipt_status as enum ('uploaded','parsing','parsed','failed');

create type issue_type as enum (
  'damaged',          -- abîmé / écrasé
  'missing_quantity', -- quantité manquante
  'expired',          -- date dépassée
  'quality',          -- goût / texture anormale
  'foreign_object',   -- corps étranger
  'flat_drink',       -- boisson sans gaz
  'other'             -- texte libre (ou voix, P2)
);

create type claim_status as enum (
  'draft',          -- created by Dev 1, not yet sent
  'submitting',     -- H agent session running
  'submitted',      -- form sent (or dry run done), waiting for a brand reply
  'waiting_input',  -- brand asked for more information
  'accepted',       -- brand promised a refund or voucher
  'refused',        -- brand declined
  'agent_failed',   -- technical failure, can be retried
  'needs_manual',   -- agent blocked (captcha, login, no form, missing info)
  'cancelled'       -- user cancelled
);

create type brand_source as enum ('seed','linkup','manual');
create type email_classification as enum ('acknowledgement','accepted','refused','waiting_input','other');
```

### Allowed status transitions (enforced in `lib/claims/transition.ts`)
```
draft         → submitting | cancelled
submitting    → submitted | needs_manual | agent_failed | cancelled
agent_failed  → submitting                       (retry)
needs_manual  → submitting | cancelled           (retry after brand fix)
submitted     → waiting_input | accepted | refused
waiting_input → submitted | accepted | refused
```
Every transition inserts a `claim_events` row.

## 2. Database schema (Supabase / Postgres)

All tables have `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()`, so those columns are omitted below. **Owner = the dev whose code writes the table.**

### `profiles` (owner: Dev 1)
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` (no default) |
| first_name, last_name | text not null | |
| phone | text | |
| address_line1 | text not null | |
| address_line2 | text | |
| postal_code, city | text not null | |
| country | text not null default 'FR' | |
| iban | text | optional, P2 |
| updated_at | timestamptz | |

### `brands` (owner: Dev 1)
| column | type | notes |
|---|---|---|
| name | text unique not null | display brand, e.g. "Pringles" |
| manufacturer | text | e.g. "Kellanova" |
| aliases | text[] default '{}' | lowercase receipt spellings, e.g. `{pringles,pringl}` |
| contact_url | text | customer-service form URL (→ H agent) |
| contact_email | text | customer-service email (→ email fallback via Resend) |
| agent_hints | text | free text for the agent prompt ("choose 'Réclamation produit' in the subject dropdown") |
| requires_receipt_upload | boolean default false | |
| captcha_observed | boolean default false | |
| verified | boolean default false | true = tested by us |
| source | brand_source not null | |
| last_checked_at | timestamptz | |

### `receipts` (owner: Dev 1)
| column | type | notes |
|---|---|---|
| user_id | uuid FK auth.users not null | |
| image_path | text not null | Storage path in bucket `receipts` |
| status | receipt_status not null default 'uploaded' | |
| store_name | text | |
| purchased_at | timestamptz | |
| total_cents | integer | |
| currency | text default 'EUR' | |
| raw_parse | jsonb | full extraction (`ReceiptExtraction`, lib/receipts/parse.ts): copied lines, discounts, printed totals, `check_errors`, `needs_review` |
| error | text | |

### `line_items` (owner: Dev 1)
| column | type | notes |
|---|---|---|
| receipt_id | uuid FK receipts on delete cascade | |
| user_id | uuid not null | denormalized for RLS |
| position | integer not null | order on the receipt |
| raw_label | text not null | e.g. "PRINGLES ORIG 175G" |
| product_name | text not null | = `raw_label` until the product is confirmed, then the confirmed name |
| brand_id | uuid FK brands | registry match (`resolveBrand`); refreshed on confirmation |
| brand_name_guess | text | null from the parser (no LLM guess); the confirmed brand after confirmation |
| ean | text | set from `confirmed_product` on confirmation |
| quantity | numeric not null default 1 | |
| unit_price_cents | integer | |
| total_price_cents | integer not null | paid for the line, item discount included |
| product_candidates | jsonb | `ProductCandidates` (§3) from `/identify`. Display only |
| confirmed_product | jsonb | `ConfirmedProduct` (§3). **NULL until the user validates.** The only product field the agent may trust |

### `product_matches` (owner: Dev 1, service role only)
Shared cache of products confirmed by users: `(store_chain, label_key) → ean`. A confirmed match is ranked first next time; the user still confirms (never auto-confirmed).
| column | type | notes |
|---|---|---|
| store_chain | text not null default '' | normalized chain printed on the receipt |
| label_key | text not null | normalized `raw_label` |
| raw_label | text not null | last label seen, as printed |
| ean | text not null | unique with (store_chain, label_key) |
| product | jsonb not null | same shape as a confirmed `confirmed_product` |
| confirmations | integer default 1 | |
| last_confirmed_at | timestamptz | |

### `claims` (insert: Dev 1 as `draft` · every later update: Dev 2)
| column | type | written by |
|---|---|---|
| user_id | uuid not null | Dev 1 |
| receipt_id | uuid FK receipts | Dev 1 |
| line_item_id | uuid FK line_items | Dev 1 |
| brand_id | uuid FK brands | Dev 1 (may be null) → Dev 2 fills it after lookup |
| issue_type | issue_type not null | Dev 1 |
| issue_description | text | Dev 1 (user free text) |
| issue_photo_path | text | Dev 1 (optional Storage path) |
| status | claim_status not null default 'draft' | Dev 2 (after draft) |
| inbound_alias | text unique | Dev 2, e.g. `claim-8f3k2a` |
| complaint_text | text | Dev 2 |
| h_session_id | text | Dev 2 |
| h_agent_view_url | text | Dev 2 |
| attempt | integer default 0 | Dev 2 |
| dry_run | boolean default false | Dev 2 |
| submission_channel | text check in ('web_form','email') | Dev 2 (how it was actually sent) |
| confirmation_number | text | Dev 2 |
| failure_reason | text | Dev 2 (blocker code or error) |
| submitted_at, resolved_at, updated_at | timestamptz | Dev 2 |

### `claim_events` (owner: Dev 2)
| column | type | notes |
|---|---|---|
| claim_id | uuid FK claims on delete cascade | |
| type | text not null | `status_change` · `agent_update` · `email_received` · `note` |
| from_status, to_status | claim_status | for `status_change` |
| payload | jsonb | anything useful (H status, error, email id) |

### `claim_emails` (owner: Dev 2)
| column | type | notes |
|---|---|---|
| claim_id | uuid FK claims | null if unmatched |
| provider_message_id | text unique not null | idempotency |
| from_address, to_address | text not null | |
| subject | text | |
| body_text | text | |
| received_at | timestamptz not null | |
| classification | email_classification | |
| classification_reason | text | |

### RLS
- `profiles`, `receipts`, `line_items`: a user can read and write rows where `user_id = auth.uid()` (`id` for profiles).
- `claims`: the user can read their own rows and insert their own rows with `status = 'draft'`. Users never update. Updates go through server routes with the service role.
- `claim_events`, `claim_emails`: the user can read rows whose claim belongs to them. Only the service role writes.
- `brands`: any authenticated user can read. Only the service role writes.
- `product_matches`: no user access (RLS on, no policy). Only the service role reads and writes.

### Storage
Bucket `receipts` (private). Paths:
- `{userId}/{receiptId}.jpg`
- `{userId}/claims/{claimId}-issue.jpg`

### Migrations
`supabase/migrations/<timestamp>_<name>.sql`. Timestamps prevent filename collisions. **Never edit a migration that's already on `main`; add a new one.** `0001_init` (everything above) is written together at kickoff.

## 3. Shared TypeScript types (`lib/shared/types.ts`)

Row types come from `lib/shared/database.types.ts` (generated). The types below are the **non-DB** contracts.

```ts
import { z } from "zod";

export const ISSUE_TYPES = ["damaged","missing_quantity","expired","quality","foreign_object","flat_drink","other"] as const;
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

export const CLAIM_STATUSES = ["draft","submitting","submitted","waiting_input","accepted","refused","agent_failed","needs_manual","cancelled"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ---- Receipt parser output (Dev 1 produces; validated with zod) ----
export const ParsedReceiptSchema = z.object({
  store_name: z.string().nullable(),
  purchased_at: z.string().nullable(),          // ISO 8601
  currency: z.literal("EUR"),
  total_cents: z.number().int().nullable(),
  items: z.array(z.object({
    raw_label: z.string(),
    product_name: z.string(),                    // = raw_label (the LLM never names the product)
    brand_guess: z.string().nullable(),          // null (the LLM never guesses the brand)
    quantity: z.number().positive(),
    unit_price_cents: z.number().int().nullable(),
    total_price_cents: z.number().int(),
  })),
});
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

// ---- Product identification, step 2 (Dev 1). Every product field comes from a product DB, never from the LLM ----
export const ProductSchema = z.object({
  ean: z.string(),                 // check digit verified
  brand: z.string().nullable(),
  name: z.string(),
  quantity: z.string().nullable(), // e.g. "175 g"
  image_url: z.string().nullable(),
  source: z.enum(["off","obf","linkup","confirmed_match"]),
});
// line_items.confirmed_product (NULL until the user validates)
export const ConfirmedProductSchema = z.discriminatedUnion("status", [
  ProductSchema.extend({ status: z.literal("confirmed") }),
  z.object({ status: z.literal("not_found") }),   // none of the candidates is the user's product
]);
// line_items.product_candidates: top 5 + llm_guess (a hint, never a result) + uncertain / uncertain_reasons
export const ProductCandidatesSchema = z.object({ llm_guess, candidates /* max 5, with score, reference_price_cents, reasons */, uncertain, uncertain_reasons, searched_at });

// ---- H agent structured answer (Dev 2) ----
export const AGENT_BLOCKERS = ["captcha","login_required","no_contact_form","missing_info","upload_failed","site_error","other"] as const;
export const AgentAnswerSchema = z.object({
  submitted: z.boolean(),
  confirmation_number: z.string().nullable(),
  form_url: z.string().nullable(),              // URL of the form actually used
  blocker: z.enum(AGENT_BLOCKERS).nullable(),
  notes: z.string(),                            // short explanation / 'dry_run_ready'
});
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

// ---- Brand contact (Dev 1 provides, Dev 2 consumes) ----
export type BrandContact = {
  brandId: string;
  name: string;
  contactUrl: string | null;   // web form → H agent
  contactEmail: string | null; // fallback: no form, or agent blocked → email via Resend
  agentHints: string | null;
  requiresReceiptUpload: boolean;
  verified: boolean;
};
```

## 4. Cross-owner function contracts

```ts
// lib/brands/index.ts (resolveBrand: Dev 1 · getBrandContact: Dev 2)
export async function resolveBrand(label: string, brandGuess: string | null): Promise<{ brandId: string } | null>;
/** (Dev 2) Registry entry; if unknown or without contact_url/contact_email and never checked, runs ONE Linkup lookup
 *  (lib/brands/discover.ts) and caches it in brands (source='linkup', verified=false, last_checked_at=now). */
export async function getBrandContact(input: { brandId: string } | { brandName: string }): Promise<BrandContact>;

// lib/shared/llm.ts (Dev 1 creates, both use)
export async function generateObject<T>(schema: z.ZodType<T>, prompt: string, opts?: { images?: { mediaType: string; base64: string }[] }): Promise<T>;
export async function generateText(prompt: string, opts?: { maxTokens?: number }): Promise<string>;

// lib/claims/transition.ts (Dev 2)
export async function transitionClaim(claimId: string, to: ClaimStatus, payload?: Record<string, unknown>): Promise<void>; // throws on illegal transition
```

## 5. HTTP endpoints

All endpoints use JSON unless noted. Errors return `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status. User endpoints require a Supabase session cookie; webhooks require a valid signature.

### Dev 1
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/receipts` | multipart: `image` (jpeg/png/webp/heic **≤ 4.5 MB**: Vercel's body limit, the page downsizes the photo first) | `201 { receiptId, status: "parsed" \| "failed", items: LineItemRow[] }` (synchronous parse, `maxDuration=120`) · `413 image_too_large` |
| POST | `/api/receipts/:id/identify` | `{ lineItemId }` (**one item per call**; the page calls them in parallel) | `200 { lineItemId, productCandidates: ProductCandidates }`, also saved in `line_items.product_candidates` (`maxDuration=60`) |
| POST | `/api/receipts/:id/confirm` | `{ lineItemId, ean: string \| null }` (`null` = "je ne trouve pas mon produit") | `200 { lineItemId, confirmedProduct: ConfirmedProduct }`; updates `ean`, `product_name`, `brand_name_guess`, `brand_id` and `product_matches` |
| POST | `/api/claims` | `{ receiptId, items: [{ lineItemId, issueType, issueDescription?, issuePhotoPath? }] }` | `201 { claimIds: string[] }`. Inserts `draft` claims, then calls submit for each. `400 product_not_confirmed` if an item has `confirmed_product = null` (enforced once the selection page ships) |

**Product identity in claims (Dev 2 reads, Dev 1 guarantees).** Read the product from `line_items.confirmed_product`:
- `status = "confirmed"`: use its `name`, `brand`, `ean` (also mirrored in `product_name`, `brand_name_guess`, `ean`).
- `status = "not_found"`, or `null` (defensive): the claim goes out marked **"produit non identifié"**: the complaint text and the agent instruction quote the receipt label as printed (`raw_label`) and never state a brand or an EAN. Never present `raw_label` or `product_candidates` as the identified product.

Reads (receipt, items, profile) go directly through the Supabase client with RLS, not through custom endpoints.

### Dev 2
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/claims/:id/submit` | none | `202 { status: "submitting", agentViewUrl }` · `409` if the status doesn't allow it · `200 { status: "needs_manual", reason }` if no contact form |
| POST | `/api/claims/:id/cancel` | none | `200 { status: "cancelled" }` (deletes the H session if running) |
| POST | `/api/claims/:id/sync` | none | `200 { status }`. Polls H if `submitting`; the claim page calls it every 5s |
| POST | `/api/webhooks/h` | H webhook payload `{type,id,created_at,data:{session_id,status,previous_status}}` | `200` (idempotent on `X-H-Webhook-Delivery`) |
| POST | `/api/webhooks/resend` | Resend `email.received` event (Svix-signed) | `200` |

`/submit` and `/cancel` accept either the user's session (the owner of the claim) or the header `x-internal-key: $INTERNAL_API_KEY` for server-to-server calls from `/api/claims`.

### Mock mode (unblocks Dev 1 before the agent works)
If `AGENT_MOCK=true`, `/submit` skips H. It sets `submitting`, then `/sync` moves the claim to `submitted` after ~10s with a fake `h_agent_view_url`. Dev 2 ships this stub by milestone M0.
