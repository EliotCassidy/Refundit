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
  'waiting_input',  -- information requested from the user (brand form required it, or brand replied asking)
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
submitting    → submitted | waiting_input | needs_manual | agent_failed | cancelled
agent_failed  → submitting                       (retry)
needs_manual  → submitting | cancelled           (retry after brand fix)
submitted     → waiting_input | accepted | refused
waiting_input → submitting | submitted | accepted | refused | cancelled   (submitting = resubmit with the user's answers)
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
| civility | text | nullable, check in (`madame`, `monsieur`, `autre`); sent to the agent for civility fields (migration `20261107235000`) |
| iban | text | optional; normalized + mod-97 checked (`lib/shared/iban.ts`); UI only shows it masked; never sent to the agent |
| updated_at | timestamptz | |

### `brands` (owner: Dev 1)
| column | type | notes |
|---|---|---|
| name | text unique not null | display brand, e.g. "Pringles" |
| manufacturer | text | e.g. "Kellanova" |
| aliases | text[] default '{}' | lowercase receipt spellings, e.g. `{pringles,pringl}` |
| contact_url | text | customer-service form URL (→ H agent) |
| contact_email | text | customer-service email (→ email fallback via Gmail) |
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
Shared cache of products confirmed by users: `(store_chain, label_key) → ean`. A label with a manual match is answered at once by `/identify` and pre-filled by the receipt page (`knownCandidates`, §5). The seed adds one row for the demo NotCoca line (fictional EAN `2000000000008`, GS1 prefix 20–29 = in-store use, never a real product).
| column | type | notes |
|---|---|---|
| store_chain | text not null default '' | normalized chain printed on the receipt |
| label_key | text not null | normalized `raw_label` |
| raw_label | text not null | last label seen, as printed |
| ean | text not null | unique with (store_chain, label_key) |
| product | jsonb not null | same shape as a confirmed `confirmed_product` |
| confirmations | integer default 1 | |
| last_confirmed_at | timestamptz | |
| manual_confirmations | integer not null default 0 | explicit user choices only (click on a candidate, typed barcode). Automatic validations never write here. The "already known" shortcut and the +30 bonus use only rows with `manual_confirmations ≥ 1` |

### `lookup_cache` (owner: Dev 1, service role only)
Persistent cache of product lookups in production (Vercel has no disk): OFF / OBF / Open Prices responses, LLM label expansions, Linkup answers.
| column | type | notes |
|---|---|---|
| key | text primary key | sha1 of the request (URL, LLM prompt, Linkup query); written with upsert |
| value | jsonb | the answer (null = 404 / not found) |
| empty | boolean not null default false | "not found" / empty result: expires after 24 h |
| created_at | timestamptz | refreshed on each upsert |
Only real answers are stored (200, or 404): never an error, a 429/5xx or a timeout.
Also holds the last full `/identify` result per label: key `identify:v1|<normalized chain>|<normalized raw_label>` → `ProductCandidates` (photos included), read by `knownCandidates` (§5).

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
| inbound_alias | text unique | Dev 2, e.g. `claim-8f3e2a1b` |
| complaint_text | text | Dev 2 |
| h_session_id | text | Dev 2 |
| h_agent_view_url | text | Dev 2 |
| attempt | integer default 0 | Dev 2 |
| dry_run | boolean default false | Dev 2 |
| submission_channel | text check in ('web_form','email') | Dev 2 (how it was actually sent) |
| missing_fields | text[] not null default '{}' | Dev 2: labels (as on the brand form) to ask the user while `waiting_input` |
| user_answers | jsonb not null default '{}' | Dev 2 (via `/answers`): `{ "<field label>": "<value>" }`, passed to the agent and the email |
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
- `product_matches`, `lookup_cache`: no user access (RLS on, no policy). Only the service role reads and writes.

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
  source: z.enum(["off","obf","linkup","confirmed_match","catalog"]),
});
// source "catalog" = the brand's own catalog, only for our fictional demo brand NotCoca (absent from Open Food Facts):
// a label naming NotCoca gets NotCoca Original/Zéro/Cherry/Citron in the format read on the receipt, fictional EANs
// (GS1 prefix 20-29), photo /notcoca/cans/<recipe>.png. Never a real Coca-Cola product.
// source "linkup" = named by the Linkup web search for this label: OFF data when OFF has the EAN, otherwise brand/name/quantity
// as described by the web page where the EAN is written (no photo). +15 in the ranking, never auto-validated (`confident` false).
// line_items.confirmed_product (NULL until the user validates)
export const ConfirmedProductSchema = z.discriminatedUnion("status", [
  // from a product DB (EAN verified), OR typed by the user when nothing matched: source "user", ean null (user facts, rule 1)
  ProductSchema.extend({ status: z.literal("confirmed"), ean: z.string().nullable(), source: z.enum([...PRODUCT_SOURCES, "user"]) }),
  z.object({ status: z.literal("not_found") }),   // none of the candidates is the user's product
]);
// line_items.product_candidates: top 5 + llm_guess (a hint, never a result) + uncertain / uncertain_reasons
// + confident: the 1st is right in ≥ 90% of cases on our eval → the page validates it directly (the user can change it)
export const ProductCandidatesSchema = z.object({ llm_guess, candidates /* max 5, with score, reference_price_cents, reasons */, uncertain, uncertain_reasons, confident, searched_at });

// ---- H agent structured answer (Dev 2) ----
export const AGENT_BLOCKERS = ["captcha","login_required","no_contact_form","missing_info","upload_failed","site_error","other"] as const;
export const AgentAnswerSchema = z.object({
  submitted: z.boolean(),
  confirmation_number: z.string().nullable(),
  form_url: z.string().nullable(),              // URL of the form actually used
  blocker: z.enum(AGENT_BLOCKERS).nullable(),
  customer_email_entered: z.boolean(),          // self-check: customer email typed into the form
  submit_button_found: z.boolean(),             // self-check: the real "send" button was found
  guessed_fields: z.array(z.string()),          // fields filled WITHOUT provided data (must be empty)
  missing_fields: z.array(z.string()),          // REQUIRED fields we have no data for (exact form labels)
  notes: z.string(),                            // short explanation / 'dry_run_ready'
});
// missing_fields ∪ guessed_fields non-empty → waiting_input (the dashboard asks the user, then resubmits).
// Dry run counts as success only if customer_email_entered && submit_button_found,
// otherwise the claim goes to needs_manual "form_incomplete: …" (spike finding: the agent sometimes stopped
// on step 1 of a multi-step form, or picked arbitrary dropdown values).
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

// ---- Brand contact (Dev 1 provides, Dev 2 consumes) ----
export type BrandContact = {
  brandId: string;
  name: string;
  contactUrl: string | null;   // web form → H agent
  contactEmail: string | null; // fallback: no form, or agent blocked → email via Gmail
  agentHints: string | null;
  requiresReceiptUpload: boolean;
  verified: boolean;
};
```

## 4. Cross-owner function contracts

```ts
// lib/brands/index.ts (resolveBrand: Dev 1 · getBrandContact: Dev 2)
/** Registry brand read in the label: whole words for brand names, word start for aliases (an alias ending with a space
 *  = whole word), longest match wins ("NOTCOCA" → NotCoca, not Coca-Cola). Registry only, no network call. */
export async function resolveBrand(label: string, brandGuess: string | null): Promise<{ brandId: string; name: string } | null>;
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
| POST | `/api/receipts` | multipart: `image` (jpeg/png/webp/heic **≤ 4.5 MB**: Vercel's body limit, the page downsizes the photo first) | `201 { receiptId, status: "parsed" \| "failed", items: LineItemRow[] }` (synchronous parse, `maxDuration=120`) · `413 image_too_large` · `402 scan_limit_reached` (monthly free quota used, checked before upload; bypassed for emails listed in `SCAN_QUOTA_EXEMPT_EMAILS`) |
| POST | `/api/profile` | `{ first_name, last_name, phone, address_line1, address_line2?, postal_code, city, country?, civility?, iban? }` (zod-validated, French error messages; `country` defaults to `FR`) | `200 { profile }` (creates or updates the signed-in user's `profiles` row, `id` = `auth.users.id`, via RLS) · `400 invalid_profile` · `401` |
| POST | `/api/receipts/:id/identify` | `{ lineItemId, ean?, query?, full? }` (**one item per call**; the page runs 3 at a time). Without `ean`/`query`/`full`, `knownCandidates(chain, raw_label)` answers at once when the label is known, in this order: 1) products confirmed by hand for this label at this chain (`product_matches`, `manual_confirmations ≥ 1`, `source: confirmed_match`), 2) the last full result for this label (`lookup_cache`); otherwise the full search runs and its result is cached per label. `full: true` ("Chercher d'autres produits") skips both. The receipt page (`/receipts/[id]`) calls the same `knownCandidates` on load for items without candidates and saves them in `product_candidates`, so known photos show without any `/identify` call. **Brand guard:** if the label matches a registry brand (`resolveBrand`) and the 1st candidate is another brand, `confident` is false (never auto-validated). Fallbacks when the product isn't proposed: `ean` = barcode typed or scanned by the user (exact OFF/OBF product), `query` = product name typed by the user | `200 { lineItemId, productCandidates: ProductCandidates }`, also saved in `line_items.product_candidates` (`maxDuration=60`) · `400 invalid_ean` · `404 ean_unknown` |
| POST | `/api/receipts/:id/confirm` | `{ lineItemId, ean: string \| null, manual?: { name, brand?, quantity? }, auto? }` (`auto: true` = validated automatically by the page: sets `confirmed_product` but never writes `product_matches`, and keeps the registry brand read in the label when there is one; an explicit choice keeps the chosen product's brand. An explicit choice can replace an already confirmed product, even an automatic one: the replaced product loses one `manual_confirmations` for this label and the cached result for this label is no longer `confident`, so a wrong product never comes back validated): `ean` must be a proposed candidate; `null` = "je ne trouve pas mon produit" (`not_found`); `null` + `manual` = product typed by the user (`confirmed`, source `user`, no EAN) | `200 { lineItemId, confirmedProduct: ConfirmedProduct }`; updates `ean`, `product_name`, `brand_name_guess`, `brand_id` and, for explicit choices of DB products only, `product_matches` (`manual_confirmations + 1`) |
| POST | `/api/claims` | `{ receiptId, items: [{ lineItemId, issueType, issueDescription?, issuePhotoPath? }] }` | `201 { claimIds: string[] }`. Inserts `draft` claims, then calls submit for each. `400 product_not_confirmed` if an item has `confirmed_product = null` |

**Product identity in claims (Dev 2 reads, Dev 1 guarantees).** Read the product from `line_items.confirmed_product`:
- `status = "confirmed"`: use its `name`, `brand`, `ean` (also mirrored in `product_name`, `brand_name_guess`, `ean`).
- `status = "not_found"`, or `null` (defensive): the claim goes out marked **"produit non identifié"**: the complaint text and the agent instruction quote the receipt label as printed (`raw_label`) and never state a brand or an EAN. Never present `raw_label` or `product_candidates` as the identified product.

Reads (receipt, items, profile) go directly through the Supabase client with RLS, not through custom endpoints.

### Dev 2
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/claims/:id/submit` | none | `202 { status: "submitting", agentViewUrl }` · `409` if the status doesn't allow it · `200 { status: "needs_manual", reason }` if no contact form |
| POST | `/api/claims/:id/cancel` | none | `200 { status: "cancelled" }` (deletes the H session if running) |
| GET | `/api/claims/:id/agent` | none (owner or `x-internal-key`) | `200 { status, steps: [{ at, kind: "screenshot"\|"action"\|"error", text, screenshot (proxy URL), pageUrl }] }` — built-in Agent View |
| GET | `/api/claims/:id/agent/screenshot?src=…` | none (owner) | the PNG, proxied from H (only URLs of this claim's session) |
| POST | `/api/claims/:id/answers` | `{ answers: { "<field label>": "<value>" } }` (only `missing_fields` keys are kept) | `200 { status: "waiting_input", remaining: string[] }` while fields are missing · then resubmits: `202 { status: "submitting", agentViewUrl }` · `409` if not `waiting_input` |
| POST | `/api/claims/:id/sync` | none | `200 { status }`. Polls H if `submitting`; the claim page calls it every 5s |
| POST | `/api/webhooks/h` | H webhook payload `{type,id,created_at,data:{session_id,status,previous_status}}` | `200` (idempotent on `X-H-Webhook-Delivery`) |
| POST | `/api/email/poll` | none (user session or `x-internal-key`) | `200 { scanned, stored, skipped }` or `{ skipped: "throttled" }`. Reads brand replies from the Gmail inbox (IMAP), at most once a minute; called by the dashboard |

`/submit` and `/cancel` accept either the user's session (the owner of the claim) or the header `x-internal-key: $INTERNAL_API_KEY` for server-to-server calls from `/api/claims`.

### Profile additions (onboarding, Dev 2)
- `profiles.civility` text check in (`madame`, `monsieur`, `autre`), nullable (migration `20261107235000`). Passed to the agent: it uses it for civility fields instead of guessing.
- `POST /api/profile` also accepts optional `civility` and `iban` (normalized, mod-97 checked by `lib/shared/iban.ts`); they are only written when sent, so the profile page is unaffected.
- `POST /api/profile/iban` `{ iban }` → `200 { ok: true }` · `400 invalid_iban`: sets the IBAN only (dashboard reminder).

### Jury demo mode (Dev 2) — demo account only (`refundit@demo.fr`, lib/demo/config.ts)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/demo/reset` | none (demo session) | `200 { ok, removed: { claims, receipts } }` — restores the saved snapshot (private Storage `receipts/_demo/snapshot.json`) (deletes what the demo run created, incl. its NotCoca requests) · `403 not_demo` |
| GET | `/api/demo/notcoca-admin` | none (demo session) | `303` → `/notcoca/admin` with the back-office cookie set |

### Payouts (Dev 2) — refunds to the user's bank, Stripe TEST mode
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/payouts` | none (user session) | `200 { availableCents, pendingCents, bankLast4 }` (Stripe balance of `profiles.stripe_account_id`) · `409 no_payout_account` · `502 stripe_error` |
| POST | `/api/payouts` | none | `200 { payoutId, amountCents }` (pays out the whole available EUR balance to the account's bank) · `409 nothing_available` · `409 no_payout_account` · `502 stripe_error` |

### Billing (Dev 2) — "Refundit Illimité", €9.99/month, Stripe test mode
Free plan: **1 receipt scan per calendar month** (Europe/Paris); subscribed (`active`/`trialing`): unlimited.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/billing/checkout` | none (user session) | `200 { url }` → redirect to Stripe Checkout |
| GET | `/api/billing/return?session_id=…` | Stripe success URL | `303` → `/billing?status=success\|error` (activates the subscription without waiting for the webhook) |
| POST | `/api/billing/cancel` | none | `200 { cancelAtPeriodEnd: true }` |
| POST | `/api/webhooks/stripe` | Stripe event (signed, `STRIPE_WEBHOOK_SECRET`) | `200`; handles `customer.subscription.created/updated/deleted` |

**Dev 1 — quota check in `POST /api/receipts`** (before uploading):
```ts
import { getScanQuota } from "@/lib/billing";
const quota = await getScanQuota(user.id);
if (!quota.canScan) return apiError(402, "scan_limit_reached", "Scan gratuit du mois utilisé : passez à Refundit Illimité.");
```
On `402`, the upload page links to `/billing`. Profile page / nav should link to `/billing` ("Mon abonnement").
Columns: `profiles.stripe_customer_id`, `subscription_status`, `subscription_period_end` (migration `20261107220000`).

### NotCoca (fictional demo brand, Dev 2)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/notcoca/requests` | NotCoca contact form (`NotCocaRequestSchema`, `lib/notcoca/catalog.ts`) | `201 { ticketNumber }` · `400` invalid form |
| POST | `/api/notcoca/admin/login` | form `key` | `303` → `/notcoca/admin` + cookie |
| POST | `/api/notcoca/admin/requests/:id/decision` | `{ kind: "refund", refundCents, compensationCents }` or `{ kind: "reject", reason }` | `200 { paymentId \| null }` · `401` without admin cookie |

Tables/columns: `notcoca_requests` (service role only), `profiles.stripe_account_id`, `claims.refund_cents`, `claims.stripe_payment_id` (migration `20261107200000`).

### Mock mode (unblocks Dev 1 before the agent works)
If `AGENT_MOCK=true`, `/submit` skips H. It sets `submitting`, then `/sync` moves the claim to `submitted` after ~10s with a fake `h_agent_view_url`. Dev 2 ships this stub by milestone M0.
