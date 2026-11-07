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
- Onboarding (civility, identity and postal address, IBAN optional).
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
                             Gmail inbox ──IMAP poll──► /api/email/poll (on dashboard open)
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
| C7 | Email (Gmail): fallback sending, reply polling + classification | Dev 2 | `lib/email/**`, `app/api/email/poll` |
| C8 | Claims dashboard + claim detail | Dev 2 | `app/(app)/claims/**` |
| S | Shared: types, Supabase clients, LLM helper, UI kit | Both | `lib/shared/**`, `components/ui/**` |

## 4. Data flows

### 4.1 Receipt → line items (Dev 1)
1. The client sends `POST /api/receipts` (multipart image). The phone uses `<input type="file" accept="image/*" capture="environment">`.
2. The server stores the image in the Storage bucket `receipts/{userId}/{receiptId}.jpg` and inserts a `receipts` row with `status='parsing'`.
3. The server calls the parser (provider chosen by Dev 1). It must return `ParsedReceipt` (API_CONTRACTS §3), validated with zod.
4. For each item, `resolveBrand(label)` (C4) tries to match a `brands` row by name or alias. If there's no match, `brand_id = null` and `brand_name_guess` is set.
5. The server inserts `line_items` and sets `receipts.status='parsed'`, or `'failed'` with an `error`.
6. Parsing is synchronous inside the request (`maxDuration = 120`: extraction + one retry). The client shows a spinner. Vercel caps request bodies at 4.5 MB, so the page downsizes the photo before upload.

### 4.2 Selection → claims (Dev 1 → Dev 2)
1. The page shows one card per product (photo of the 1st candidate, name, price) and calls `POST /api/receipts/:id/identify` for every line item on load (one item per call, in parallel): Open Food Facts / Open Beauty Facts candidates ranked against the receipt label and price.
   The user answers "Oui" to "Ce produit a-t-il un problème ?" on the products that had a problem (red "Non" by default, green "Oui" opens the sub-menu) and picks an `issue_type` for each, plus an optional description and an optional photo of the damaged product; "Ce n'est pas le bon produit" opens the product choice. The user confirms the product (auto-validated when `confident`), or "je ne trouve pas mon produit" → `/confirm` fills `line_items.confirmed_product` (API_CONTRACTS §2, §5).
2. The client sends `POST /api/claims` (Dev 1). The server inserts one `claims` row per item with `status='draft'`.
3. The server then calls `POST /api/claims/{id}/submit` for each claim (Dev 2's endpoint; server-to-server, or the client fires them after creation).
4. **This handoff is the integration seam.** Dev 1 never touches a claim after `draft`.

### 4.3 Submission (Dev 2)
`POST /api/claims/{id}/submit`:
1. Load the claim, line item, receipt, profile and brand.
2. **Brand contact:** call `getBrandContact(brandId | brandNameGuess)`. It returns the registry entry or runs a Linkup lookup and saves the result.
   - **Channel order:** `contact_url` → H agent (web form). No form but a `contact_email` → **email fallback** (Gmail SMTP from the dedicated account, Reply-To = the claim's plus address). Neither → `needs_manual`.
   - If the agent ends blocked (`captcha`, `login_required`, `no_contact_form`, …) and the brand has a `contact_email`, `syncClaim` falls back to email instead of `needs_manual`.
   - In dry run, the email is not sent (claim → `submitted` + `dry_run`). Without `GMAIL_USER` / `GMAIL_APP_PASSWORD`, a real run → `needs_manual` "email_not_configured".
   - If there's no contact URL, move to `needs_manual` with reason `no_contact_form`.
3. Generate `inbound_alias` (for example `claim-8f3e2a1b`) and the inbound address.
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
One dedicated Gmail account (free, no domain). Each claim gets a **plus address**: `refundit.reclamations+claim-8f3e2a1b@gmail.com` (Gmail delivers it to the main inbox). It is the only email given to brands (forms and emails). Because some forms reject "+", the complaint text also ends with `Référence de ma demande : claim-8f3e2a1b`.
1. Gmail has no webhook: `POST /api/email/poll` reads unread inbox messages of the last 14 days over IMAP. The dashboard calls it when it opens (throttled to once a minute).
2. The claim is matched by the plus tag in To/Cc/Delivered-To, else by `claim-xxxxxxxx` in the subject/body. Other messages are left unread and ignored.
3. A `claim_emails` row is stored (idempotent on Message-ID), the LLM classifies it (§6), the claim status changes, the message is marked read.
4. If the brand **asks for information** (`waiting_input` with `missing_fields` from the classification), the dashboard asks the user; `/answers` then **replies to the brand's email** (In-Reply-To) instead of refiling the form, and the claim goes back to `submitted`.

### 4.6 Dashboard (Dev 2)
`/claims`: counters (En cours / À compléter / Acceptées / Refusées), "Informations demandées" first, then every claim with status, brand, issue and refund. Opening it polls the Gmail inbox (`/api/email/poll`) and `/sync`s claims still `submitting`.

`/claims/[id]`:
- status, channel (web form / email), confirmation or refund ("Remboursé 7,45 € · Stripe pi_…");
- **built-in Agent View**: live screenshot + action log while `submitting` (polls every 3 s), step-by-step replay afterwards. Served by owner-only routes `/api/claims/:id/agent` and `/agent/screenshot` that proxy the H session events and screenshots with our H key. **No public H share link**: the screenshots show the customer's personal data typed into the brand form;
- form for `missing_fields` (resubmits, or answers the brand's email), Cancel (stops the H session) / Retry, complaint text, timeline (status changes + brand emails).

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
| `completed` / `idle` | `missing_fields` or `guessed_fields` non-empty (DLC, batch number, "still have the product?"…) | `waiting_input`: the dashboard asks the user, `/answers` resubmits with `user_answers` |
| `completed` | `blocker` ∈ captcha, login_required, no_contact_form, upload_failed (or form_incomplete) | `needs_manual`, or **email fallback** if the brand has a `contact_email` |
| `failed` / `timed_out` / answer validation error | n/a | `agent_failed` (UI offers Retry) |
| `interrupted` after user cancel | n/a | `cancelled` |

Retry = a new session with attempt+1. Allow at most 2 automatic attempts per claim.

## 5b. Demo brand "NotCoca" + Stripe (Dev 2)

NotCoca is a **fictional** soda brand served by this app at `/notcoca` (public, no Refundit auth, `noindex`). Its page structure and contact flow mirror a real French soda consumer-service site (spike 2026-11-07) so the agent faces a realistic multi-step form; its visual identity (logo, colours, type) is its own, with no third-party branding.

1. `/notcoca/contact`: two-step form (request → customer details) → `POST /api/notcoca/requests` → `notcoca_requests` + ticket `NC-xxxxxx` shown on screen.
2. `/notcoca/admin` (key `NOTCOCA_ADMIN_KEY`, hashed cookie): list requests, **Rembourser** (refund + compensation) or **Refuser**.
3. Refund → Stripe **destination charge** in TEST mode (`lib/notcoca/payout.ts`): one PaymentIntent with `pm_card_visa`, `confirm: true`, `transfer_data.destination` = the user's connected account (`profiles.stripe_account_id`). That account is an **Accounts v2 "recipient"** (fees/losses collector = application, Express dashboard, Stripe-hosted onboarding) created by `npm run stripe:demo-account`: in test mode Stripe refused a v1 account with platform-owned losses. Non-`sk_test_` keys are refused. The claim gets `refund_cents` + `stripe_payment_id`.
4. NotCoca emails the customer like a real brand (Gmail, *without* the Refundit outgoing header) → Refundit's poller classifies it `accepted` → the dashboard shows "Remboursé 7,45 €".

Demo shortcut, said in the pitch: NotCoca and Refundit share the same Stripe test platform, and NotCoca finds the payee from the claim's plus address. A real brand would pay to the IBAN given in its form.

## 5c. Billing (Dev 2) — "Refundit+", €9.99/month (Stripe test mode). Free plan: 5 scans/month + 20 % commission on transfers to the bank
- Free plan: **5 receipt scans per calendar month** (Europe/Paris) and a 20 % commission when refunds are transferred to the bank. `getScanQuota` (`lib/billing.ts`) is checked by `POST /api/receipts` → `402 scan_limit_reached` (accounts in `SCAN_QUOTA_EXEMPT_EMAILS` are exempt).
- `/billing` → `POST /api/billing/checkout` (Stripe Checkout, mode subscription; price found by `lookup_key`, created once) → `/api/billing/return` activates from the Checkout session (no webhook needed) → `/billing`. Cancel at period end via `/api/billing/cancel`.
- `/api/webhooks/stripe` (signed) applies `customer.subscription.created/updated/deleted` to `profiles.subscription_status` / `subscription_period_end`. Verified in production: subscription → webhook → `active` → unlimited; cancel → `canceled` → back to the free plan.

## 5d. Deployment
- Production: **https://refundit.vercel.app**, Vercel project linked to the GitHub repo (every push to `main` deploys). Env vars mirror `.env.example`.
- Webhooks registered on production: H (`/api/webhooks/h`, events `session.completed|failed|timed_out|idle`) and Stripe (`/api/webhooks/stripe`, subscription events).
- `AGENT_MOCK` is ignored when `VERCEL_ENV=production`. `AGENT_DRY_RUN=true` stays on (real brands); NotCoca is always submitted.
- The H cloud browser can only reach public URLs: NotCoca must be tested on the deployed app, not localhost.

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

The `brands` table is the "cache" of known contact forms and support emails.
- **Seed:** 4–5 brands verified by hand during the spike, with `verified=true`. Candidates: Pringles/Kellanova, Coca-Cola, plus 2–3 others from the demo receipt. Fill in real URLs only after checking them.
- **Matching:** `resolveBrand(label)` does a case-insensitive match on `name` and `aliases`. The LLM's `brand_guess` from parsing is the main signal.
- **Unknown brand (Dev 2, `lib/brands/discover.ts`):** `getBrandContact` calls Linkup `POST /v1/search` with `outputType: "structured"` + `includeSources: true`, asking for `{contact_form_url, support_email}` (ONE call per brand, never retried — CLAUDE.md rule 9; depth from `LINKUP_DEPTH`, `standard` by default). **Anti-hallucination:** a URL is kept only if it is, or shares a host with, a returned source; an email only if it appears verbatim in the sources. The result is cached in `brands` (`source='linkup'`, `verified=false`, `last_checked_at`), so each brand is looked up once.

## 8. Security and privacy (hackathon level)
- Supabase RLS: users can read and write only their own `profiles`, `receipts`, `line_items` and `claims` (draft inserts). `claim_events` and `claim_emails` are read-only for users. Server writes use the service role.
- The H webhook signature is verified (HMAC). Reject anything unsigned. The Gmail app password stays server-side.
- Profile data is sent to H inside the agent instruction. That's acceptable for the hackathon and is disclosed at onboarding. The civility is sent; the IBAN is not (stored for payouts, shown masked in the UI).
- The storage bucket `receipts` is private. Server code reads it to base64-encode files for H.

## 9. Environment variables
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
LLM_API_KEY (+ LLM_MODEL)                         # provider chosen by Dev 1
HAI_API_KEY, H_WEBHOOK_SECRET, AGENT_DRY_RUN=true, AGENT_MOCK=false, AGENT_ID=h/web-surfer-flash
INTERNAL_API_KEY                                  # server-to-server call /api/claims → /submit
GMAIL_USER, GMAIL_APP_PASSWORD                    # dedicated Gmail account (2-Step Verification + app password)
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
| Gmail: ~500 recipients/24 h, no webhook, some forms reject "+" addresses | Enough for a demo; poll on dashboard open; claim reference in the text as a second matching key. |
| Webhooks unreachable locally | `/sync` polling fallback. Test webhooks on the deployed Vercel URL. |
