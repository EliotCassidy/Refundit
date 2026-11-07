# Architecture

## 1. Product

**Problem.** When a supermarket product is defective (crushed Pringles, flat Coca-Cola, expired, missing quantity), almost nobody complains. Finding the brand's contact form and filling it in is tedious.

**Solution.** The user snaps the receipt, picks the products that had a problem and why, and Refundit's computer-use agent files each complaint on the brand's own contact form. Brand replies land in a per-claim inbox on the platform, and every claim's status is tracked in one dashboard.

**Users.** French supermarket shoppers. The market is France only for now, and the UI and complaints are in French.

**Principle.** Only genuine issues reported by the user. The platform automates the *paperwork*, never the *facts*.

**Demo story.**
1. The user uploads a receipt.
2. The app lists the products.
3. The user picks Pringles ("damaged") and Coca-Cola ("flat").
4. The user taps Submit.
5. The user watches the agent fill the Kellanova form live (Agent View).
6. The claim moves to `submitted`.
7. The dashboard shows another claim that already received a brand reply and is `accepted`.

### In scope
- Onboarding (identity and postal address, IBAN optional).
- Receipt upload from the phone camera, then parsing into line items.
- Item selection with issue presets plus free text.
- Brand registry (seeded, verified brands) with Linkup lookup for unknown brands.
- Autonomous agent submission, live view, cancel.
- Per-claim inbound email, reply classification, status updates, dashboard and timeline.

### Explicitly out of scope
- Finding promotional refund or cashback offers.
- Payments, Stripe, payouts.
- Native mobile app.
- Replying to brands from the platform (P2 at most).
- Multi-country support.
- Admin back-office (edit brands in the Supabase dashboard).
- Any claim generation without a user-reported issue.

## 2. System overview

```
 Phone browser (Next.js UI)
   │  upload / select / submit           ▲ read own rows (Supabase RLS)
   ▼                                     │
 Next.js route handlers on Vercel ───────┴───── Supabase (Postgres, Auth, Storage)
   │            │             │                      ▲
   │ LLM        │ Linkup      │ H Agents API         │ status updates
   ▼            ▼             ▼                      │
 receipt     brand contact  hosted browser agent ──webhook──► /api/webhooks/h
 parsing     lookup         fills brand form
                                   │ brand replies to claim alias
                                   ▼
                             Resend Inbound ──webhook──► /api/webhooks/resend
```

It's one Next.js app with no separate backend, no queue and no worker. The long-running work (the agent) runs on H's infrastructure. We create a session and react to webhooks.

## 3. Components

| # | Component | Owner | Location |
|---|---|---|---|
| C1 | Auth + onboarding/profile | Dev 1 | `app/(app)/onboarding`, `app/(app)/profile` |
| C2 | Receipt upload + parsing | Dev 1 | `app/(app)/receipts/**`, `app/api/receipts/**`, `lib/receipts/**` |
| C3 | Item & issue selection → draft claims | Dev 1 | `app/(app)/receipts/[id]/select`, `app/api/claims/route.ts` |
| C4 | Brand registry + resolution + Linkup | Dev 1 | `lib/brands/**`, `supabase/seed/brands.*` |
| C5 | Claim submission / H agent | Dev 2 | `lib/agent/**`, `app/api/claims/[id]/{submit,cancel,sync}` |
| C6 | Claim state machine | Dev 2 | `lib/claims/**` |
| C7 | Inbound email + classification | Dev 2 | `lib/email/**`, `app/api/webhooks/resend` |
| C8 | Claims dashboard + claim detail | Dev 2 | `app/(app)/claims/**` |
| S | Shared: types, Supabase clients, LLM helper, UI kit | Both | `lib/shared/**`, `components/ui/**` |

## 4. Data flows

### 4.1 Receipt → line items (Dev 1)
1. The client sends `POST /api/receipts` (multipart image). The phone uses `<input type="file" accept="image/*" capture="environment">`.
2. The server stores the image in the Storage bucket `receipts/{userId}/{receiptId}.jpg` and inserts a `receipts` row with `status='parsing'`.
3. The server calls the parser (provider chosen by Dev 1). It must return `ParsedReceipt` (API_CONTRACTS §3), validated with zod.
4. For each item, `resolveBrand(label)` (C4) tries to match a `brands` row by name or alias. If there's no match, `brand_id = null` and `brand_name_guess` is set.
5. The server inserts `line_items` and sets `receipts.status='parsed'`, or `'failed'` with an `error`.
6. Parsing is synchronous inside the request (set `maxDuration = 60`). The client shows a spinner.

### 4.2 Selection → claims (Dev 1 → Dev 2)
1. The user ticks items and picks an `issue_type` for each, plus an optional description and an optional photo of the damaged product.
2. The client sends `POST /api/claims` (Dev 1). The server inserts one `claims` row per item with `status='draft'`.
3. The server then calls `POST /api/claims/{id}/submit` for each claim (Dev 2's endpoint; server-to-server, or the client fires them after creation).
4. **This handoff is the integration seam.** Dev 1 never touches a claim after `draft`.

### 4.3 Submission (Dev 2)
`POST /api/claims/{id}/submit`:
1. Load the claim, line item, receipt, profile and brand.
2. **Brand contact:** call `getBrandContact(brandId | brandNameGuess)` (C4, Dev 1's function). It returns the registry entry or runs a Linkup lookup and saves the result.
   - If there's no contact URL, move to `needs_manual` with reason `no_contact_form`.
3. Generate `inbound_alias` (for example `claim-8f3k2a`) and the inbound address.
4. **Complaint text:** a deterministic French template (`lib/agent/complaint.ts`, no LLM, so nothing can be invented) builds a short, polite complaint from facts only:
   - product
   - purchase date and store
   - issue type
   - the user's description

   It asks for a refund or commercial gesture. The text is stored in `claims.complaint_text` so the user sees exactly what was sent.
5. Create the H session (§5) and store `h_session_id` and `h_agent_view_url`.
6. Transition to `submitting`. Return `202`.

### 4.4 Agent completion (Dev 2)
- **Primary:** H webhook `POST /api/webhooks/h`.
  - Verify `X-H-Webhook-Signature`: `sha256=` + HMAC-SHA256 of `{timestamp}.{raw_body}`.
  - Deliveries are at-least-once, so be idempotent on `X-H-Webhook-Delivery`.
  - Fetch the session, read `latest_answer`, and map it to a status (§5.3).
- **Fallback:** `POST /api/claims/{id}/sync` polls `GET /api/v2/sessions/{id}`. The claim page calls it every 5s while the claim is `submitting`. This is required in local dev, where H can't reach localhost (H rejects private hosts).

### 4.5 Brand reply (Dev 2)
1. The brand emails `claim-8f3k2a@<id>.resend.app`.
2. Resend posts `email.received` to `/api/webhooks/resend`. Verify the Svix signature.
3. The webhook only carries metadata, so **fetch the body via Resend's Receiving API**.
4. Match the claim by recipient local part → `claims.inbound_alias`. If nothing matches, store the email with `claim_id=null` and log it.
5. Store a `claim_emails` row, then classify the email with the LLM (§6) and transition the claim's status.

### 4.6 Dashboard (Dev 2)
The pages read `claims`, `claim_events` and `claim_emails` through the Supabase client with RLS. The claim page shows:
- the status badge
- the complaint text
- an embedded or linked H Agent View (live, then replay)
- a Cancel button (`DELETE` session → `cancelled`)
- the email timeline

## 5. H Company agent design

Verified against hub.hcompany.ai/agents-api docs on 2026-11-07. Recheck anything marked *unverified*.

### 5.1 Session creation
- Endpoint `POST https://agp.eu.hcompany.ai/api/v2/sessions`, `Authorization: Bearer $HAI_API_KEY`. Use the `hai-agents` TS SDK.
- Agent: `h/web-surfer-flash` by default, `h/web-surfer-pro` if flash fails on hard forms. **Compare both during the spike.**
- Start URL: the brand's `contact_url`, via `overrides: {"agent.environments[kind=web].start_url": url}`.
- `files`: the receipt image (and the issue photo, if any), base64, ≤ 7 MB total. Files land in `~/Downloads` on the cloud browser. *Unverified: whether the agent can set them on `<input type="file">`. Spike item #1.*
- `answerSchema` (zod v4): `AgentAnswer` in API_CONTRACTS §3.
- Bounds: `max_steps ≈ 60`, `max_time_s ≈ 600`. Tune these after the spike.
- `Idempotency-Key: claim-{claimId}-{attempt}`.
- Optional `network.managed_proxy` with `country: "FR"` if a site blocks datacenter IPs.

### 5.2 Instruction template (French site, English instruction is fine)
```
You are filing a genuine product complaint on behalf of a customer on the brand's official
customer-service contact form. Start URL: {contact_url}. Brand hints: {agent_hints}.

1. Find the contact form for a product complaint / "réclamation produit" (not marketing, not job offers).
2. Fill the fields ONLY with the data below. Never invent values. If a REQUIRED field asks for
   information not provided, stop and return blocker="missing_info" with the field name in notes.
3. Paste the complaint text exactly as given.
4. If there is a file-upload field for proof of purchase, upload receipt.jpg from ~/Downloads.
5. Do not create an account. If login is required, stop with blocker="login_required".
6. {DRY_RUN ? "Do NOT click the final submit button. Stop just before it and return submitted=false, notes='dry_run_ready'." : "Submit the form and capture any confirmation number or message."}

Customer: {first_name} {last_name}, {address}, {phone}, email: {inbound_address}
Product: {product_name} ({brand}), bought {purchased_at} at {store_name}, price {price}
Batch/EAN if available: {ean}
Complaint text: """{complaint_text}"""
```
The email given to brands is **always the claim's inbound address**, never the user's real email.

### 5.3 Outcome → status mapping
| H result | Answer | Claim status |
|---|---|---|
| `completed` | `submitted: true` | `submitted` |
| `completed` | `submitted: false`, notes `dry_run_ready` | `submitted` + `dry_run=true` (UI badge "Test") |
| `completed` | `blocker` ∈ captcha, login_required, no_contact_form, missing_info, upload_failed | `needs_manual` |
| `failed` / `timed_out` / answer validation error | n/a | `agent_failed` (UI offers Retry) |
| `interrupted` after user cancel | n/a | `cancelled` |

Retry = a new session with attempt+1. Allow at most 2 automatic attempts per claim.

## 6. LLM usage

There's one provider for the whole app (Dev 1 picks it while building the receipt parser), wrapped in `lib/shared/llm.ts` with a typed helper `generateObject(schema, prompt, {images?})`.

| Task | Owner | Output |
|---|---|---|
| Receipt image → `ParsedReceipt` (items, normalized names, brand guess) | Dev 1 | JSON (zod) |
| Brand reply classification | Dev 2 | `{classification, reason, needs_user_action}` |

Reply classification:
- `acknowledgement` → no status change
- `accepted` (voucher or refund promised) → `accepted`
- `refused` → `refused`
- `waiting_input` (asks for batch number, photo, etc.) → `waiting_input`
- `other` → no change, but shown in the timeline

## 7. Brand registry and lookup

The `brands` table is the "cache" of known contact forms.
- **Seed:** 4–5 brands verified by hand during the spike, with `verified=true`. Candidates: Pringles/Kellanova, Coca-Cola, plus 2–3 others from the demo receipt. Fill in real URLs only after checking them.
- **Matching:** `resolveBrand(label)` does a case-insensitive match on `name` and `aliases`. The LLM's `brand_guess` from parsing is the main signal.
- **Unknown brand:** `getBrandContact` queries Linkup for the brand's French customer-service contact page. It saves a `brands` row with `source='linkup'`, `verified=false` and the found `contact_url`. *Linkup request and response shapes must be checked against their docs before implementing.*

## 8. Security and privacy (hackathon level)
- Supabase RLS: users can read and write only their own `profiles`, `receipts`, `line_items` and `claims` (draft inserts). `claim_events` and `claim_emails` are read-only for users. Server writes use the service role.
- Webhook signatures are verified (H HMAC, Resend/Svix). Reject anything unsigned.
- Profile data is sent to H inside the agent instruction. That's acceptable for the hackathon and is disclosed at onboarding. IBAN is only included if a form requires it (P2).
- The storage bucket `receipts` is private. Server code reads it to base64-encode files for H.

## 9. Environment variables
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
LLM_API_KEY (+ LLM_MODEL)                         # provider chosen by Dev 1
HAI_API_KEY, H_WEBHOOK_SECRET, AGENT_DRY_RUN=true, AGENT_MOCK=false, AGENT_ID=h/web-surfer-flash
INTERNAL_API_KEY                                  # server-to-server call /api/claims → /submit
RESEND_API_KEY, RESEND_WEBHOOK_SECRET, INBOUND_DOMAIN=<id>.resend.app
LINKUP_API_KEY
GLADIA_API_KEY                                    # P2
APP_URL                                           # public URL for webhooks
```
Keep `.env.example` in the repo. Real values live in Vercel and `.env.local`, which is gitignored.

## 10. Known risks
| Risk | Mitigation |
|---|---|
| The agent can't upload the receipt file | Spike first. Otherwise mention the receipt in the text and mark the brand `requires_receipt_upload=false` / choose brands without upload. |
| CAPTCHA (H says it solves ~70%, unverified) | Pick demo brands where it passes. Others → `needs_manual`. |
| Agent slow or flaky on stage | Pre-recorded Agent View replay of a successful run, plus one claim already in `accepted`. |
| Brands don't reply during the weekend | Submit real, genuine claims on Saturday morning. If nothing arrives, show a clearly labeled simulated reply. |
| Resend managed-domain inbound limits on the free plan | Check at H+1. Fallback: Postmark inbound. |
| Webhooks unreachable locally | `/sync` polling fallback. Test webhooks on the deployed Vercel URL. |
