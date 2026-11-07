# Implementation plan

Judging weights:

| Criterion | Weight |
|---|---|
| Computer Use | 25% |
| Execution & reliability | 25% |
| Usefulness | 20% |
| Originality | 15% |
| UX & control | 10% |
| Demo | 5% |

→ The agent run must be **central, visible and reliable**. Everything else serves it.

Priorities:
- **P0** = demo breaks without it.
- **P1** = makes the demo convincing.
- **P2** = only if ahead.

## Phase 0: Kickoff (both, ~1h)
- [ ] Read all docs together. Write `supabase/migrations/<ts>_0001_init.sql` from API_CONTRACTS §2 (incl. RLS, storage bucket).
- [ ] Create the Supabase project, Vercel project and `.env.example`. Share secrets out of band.
- [ ] Agree on the demo receipt: a real receipt containing Pringles, Coca-Cola and 2–3 other brands.

## Phase 1: Scaffold + spikes (parallel, until ~H+3)
**Dev 1 (P0)**
- [ ] `create-next-app` (TS, App Router, Tailwind, ESLint), `lib/shared/*` Supabase clients, generated types, `npm run typecheck`.
- [ ] Supabase Auth (email + password, no email confirmation), protected `(app)` layout, mobile shell + nav.
- [ ] Choose the LLM provider and test receipt parsing on 3 real receipt photos → `ParsedReceipt`.

**Dev 2 (P0, the most important hours of the weekend)**
- [ ] **H spike:** run the agent by hand (SDK or CLI) on the contact forms of 3–5 candidate brands, in dry-run mode. Record for each:

  | Question | Values |
  |---|---|
  | Form found? | yes / no |
  | CAPTCHA? | yes / no |
  | Upload works? | yes / no |
  | Duration | |
  | Which model? | flash / pro |

  → fills `brands` seed rows (`verified`, `agent_hints`, `captcha_observed`, `requires_receipt_upload`).
  - **Results 2026-11-07 (dry run, with receipt file):**

    | Brand | Form | Result | Duration |
    |---|---|---|---|
    | Coca-Cola | coca-cola.com/fr/fr/about-us/contact-us | ✅ full form incl. customer details + email, real submit button found, no guessed field. No upload field. | 146–179 s (flash) |
    | Pringles (Kellanova) | kelloggs.fr/fr_FR/contact_us_fr.html | ❌ form in an iframe, submit unreachable, no customer fields at all; no official email found by Linkup → needs_manual | 186 s (pro) |
    | Evian (Danone) | danone.fr/…/eaux/reclamation-produit.html | ⚠️ requires DLC/DDM + batch number → missing_info → email fallback (contactconsodanonefrance@danone.com) | 59 s (flash) |

    Findings, all handled in code:
    - Sessions can settle in `idle` after answering → `isSettled`, `idleTimeoutS: null`, webhook must subscribe to `session.idle`.
    - The agent stopped on step 1 of a form and picked arbitrary dropdown values when not told otherwise → the answer now carries `customer_email_entered`, `submit_button_found`, `guessed_fields`, enforced in `decideOutcome`.
    - Forms often have no upload field → the complaint text no longer says "en pièce jointe".

    Open product question: some forms ask "do you still have the product?", the DLC/DDM or the batch number. The agent must not guess these, so the item selection should optionally ask for them (Dev 1 UI + contract change).
- [x] ~~Resend spike~~ → replaced by one dedicated Gmail account (free, no domain): SMTP + IMAP + plus addressing.
- [x] Ship the `AGENT_MOCK` stub for `/submit` + `/sync` (unblocks Dev 1).

**Sync H+3:** spike results → pick the **demo brands** (the ones that pass end-to-end).

## Phase 2: Build both halves (Saturday afternoon)
**Dev 1**
- [ ] P0 Onboarding form → `profiles`; redirect to it if the profile is missing.
- [ ] P0 Upload page (camera capture) → `/api/receipts` → parsed items list (edit a product name/brand inline = P1).
- [ ] P0 Brand registry seed (`npm run seed`) + `resolveBrand` + `getBrandContact` (registry only).
- [ ] P0 Selection page: checkboxes + issue preset chips + optional description → `/api/claims` → redirect to `/claims`.
- [ ] P1 Optional damaged-product photo upload.

**Dev 2**
- [x] P0 `transitionClaim` + `claim_events`.
- [x] P0 Complaint text (French, facts only): deterministic template in `lib/agent/complaint.ts`.
- [x] P0 Real `/submit`: build the instruction, attach the receipt file, `answerSchema`, store the session id + agent view URL.
- [x] P0 `/sync` polling + outcome mapping (ARCHITECTURE §5.3).
- [x] P0 Claims list + claim detail page (status, complaint text, Agent View link/iframe, Cancel).
- [x] P1 Linkup lookup in `getBrandContact` (form URL + support email, anti-hallucination check). Needs `LINKUP_API_KEY`.
- [x] P1 Email fallback (no form, or agent blocked) via Gmail SMTP. Needs `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
- [ ] P1 `/api/webhooks/h`: code done (verifyWebhook + idempotent sync). TODO: register the webhook on the deployed Vercel URL and set H_WEBHOOK_SECRET.

## Phase 3: Integration (Saturday evening). **Milestone: the full path on the deployed URL**
- [ ] Real receipt → items → select 2 → submit → agent runs (dry run) on demo brands → `submitted`.
- [ ] Fix every bug found. No new features until this works 3 times in a row.
- [ ] **Submit 3–5 genuine claims for real** (`AGENT_DRY_RUN=false`), only for products that actually had an issue, to have a chance of real brand replies by Sunday.

## Phase 4: Email loop + UX (Sunday morning)
**Dev 2**
- [x] P1 Gmail IMAP polling (`/api/email/poll`, on dashboard open) → `claim_emails` → classify → transition; brand info requests answered by email from the dashboard. Timeline on the claim detail page.
- [ ] P1 Retry button for `agent_failed` / `needs_manual`.

**Dev 1**
- [ ] P0 Quota check in `/api/receipts` (`getScanQuota` → 402) + link to `/billing` from profile/nav (API_CONTRACTS › Billing)
- [ ] P1 Home dashboard summary (counts per status), empty states, loading states, errors in French.
- [ ] P2 Gladia voice input for the "other" issue.
- [ ] P2 Inline correction of parsed items.

## Phase 5: Demo hardening (Sunday early afternoon). **Code freeze 2h before the deadline**
- [ ] Demo account with a profile, one receipt already parsed and one claim already `accepted` (real reply if received, otherwise a **clearly labeled** simulated reply).
- [ ] Record a successful Agent View replay as the backup video.
- [ ] Rehearse the demo script below on a phone, 3 times. Measure the agent's duration and cut dead time in the video.
- [ ] Prepare Q&A answers: honesty safeguards, why computer use and not APIs (brands have no APIs), CAPTCHA/failure handling, privacy.

## Demo script (~2 min)
1. Problem (15s): "Your Pringles were crushed. Would you go find Kellanova's contact form? Nobody does."
2. Snap the receipt on a phone → items appear, brands recognized.
3. Tick the NotCoca soda → "Boisson sans gaz" → Submit. (NotCoca = our fictional demo brand at `/notcoca`; Coca-Cola, Lu, Bonne Maman are the real forms already validated in dry run.)
4. **Agent View live:** the agent opens the brand site, finds the form, fills it, attaches the receipt, submits. (Core of the demo; the user can stop it at any time.)
5. Dashboard: the claim goes to `submitted` with NotCoca's ticket number. Switch to the NotCoca back-office → **Rembourser 2,45 € + 5 €** → Stripe test payment to the user's connected account → NotCoca's email lands → Refundit dashboard shows **Acceptée · Remboursé 7,45 €**.
6. Close: one inbox for every brand, every claim tracked, only genuine issues.

## Explicitly not building
Offer discovery, Stripe/payments, native app, replying to brands, admin UI, multi-country, multi-receipt batch processing, analytics.
