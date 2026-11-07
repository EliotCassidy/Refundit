# Refundit

Snap a supermarket receipt, tick the product that had a problem, and a computer-use agent files the complaint on the brand's own contact form. Brand replies come back to a dedicated address per claim, update the status, and refunds land in the app.

- **Live app:** https://refundit.vercel.app. On the login page, turn on **"Mode démo"**: it creates a throwaway account and starts a guided tour (account deleted after 30 min).
- **Demo brand:** NotCoca, a fictional brand site at [/notcoca](https://refundit.vercel.app/notcoca), with its back-office at `/notcoca/admin`.

<p align="center">
  <img src="docs/screenshot.png" width="320" alt="Refundit: the H agent filing a complaint on the brand's form, seen live from the claim page">
</p>

## Problem

- Crushed, flat, expired or incomplete products are rarely reported. Finding the right form takes too long.
- Every brand has its own contact form: several steps, dropdowns, uploads, cookie banners.
- Brands have no API for complaints. A browser agent is the only way to automate it.

## How it works

1. **Scan.** The user photographs the receipt. The H model reads every line (store, date, prices).
2. **Identify.** Each line is matched to a real product with an EAN (Open Food Facts, Open Beauty Facts, Open Prices, Linkup fallback). The user confirms or corrects it.
3. **Report.** "Ce produit a-t-il un problème ?" Oui / Non, then an issue preset (damaged, flat drink, expired...) and an optional description.
4. **File.** For each claim, an H agent opens the brand's contact form, fills it with the user's data, attaches the receipt and submits. The user watches it live.
5. **Follow up.** The brand answers a per-claim Gmail plus address. Replies are classified by the LLM, and the claim moves to accepted, refused or "info requested".
6. **Get paid.** Refunds show on the dashboard balance and can be paid out to the bank (Stripe test mode).

## Computer use

- **One H session per claim** (`hai-agents` SDK, `h/web-surfer-flash` by default). It starts on the brand's contact URL and gets the receipt photo as a file. Limits: 60 steps, 10 min. Idempotency key per attempt.
- **Instruction** ([lib/agent/instruction.ts](lib/agent/instruction.ts)) opens with absolute rules:
  - type only values written in the data;
  - never answer questions about the customer's situation ("avez-vous toujours le produit ?");
  - stop on a blocking required field;
  - re-check every field before the final click.
- **Self-checked answer**, validated with zod: `submitted`, `confirmation_number`, `blocker`, `customer_email_entered`, `submit_button_found`, `guessed_fields`, `missing_fields`.
- **Outcome mapping** ([lib/agent/outcome.ts](lib/agent/outcome.ts)):

  | Agent result | Claim status |
  |---|---|
  | Form sent | `submitted` + confirmation number |
  | Required field without data (DLC, batch number...) | `waiting_input`: the user answers, the agent runs again |
  | CAPTCHA, login, no form | email fallback if the brand has an address, else `needs_manual` |
  | Dry run, email entered and submit button found | `submitted` (test badge) |
  | Session failed, timed out, invalid answer | `agent_failed` + Retry |

- **Built-in Agent View:** live screenshots and action log while the agent runs, step-by-step replay afterwards. Served through owner-only proxy routes. No public H share links, because the screenshots show personal data.


## Architecture

One Next.js app. No separate backend, queue or worker. The long-running work runs on H's infrastructure.

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router), TypeScript strict, Tailwind 4, motion |
| Data | Supabase (Postgres + RLS, Auth, private Storage) |
| Hosting | Vercel, `fra1` region (next to Supabase) |
| Agent | H Company Agents API (`hai-agents`) |
| LLM | H Models API, `holo4-35b-a3b`, OpenAI-compatible, behind [lib/shared/llm.ts](lib/shared/llm.ts) |
| Product data | Open Food Facts, Open Beauty Facts, Open Prices, Linkup |
| Email | One Gmail account: SMTP (fallback, replies) + IMAP (brand replies) |
| Payments | Stripe test mode: Connect (refund payouts), Billing (subscription) |

## Run locally

```bash
npm install
cp .env.example .env.local      # Supabase keys, INTERNAL_API_KEY, SEED_DEMO_PASSWORD at minimum
npm run db:push                 # apply supabase/migrations
npm run seed                    # brands + demo user + demo receipt
npm run dev                     # http://localhost:3000
```

In Supabase, turn off "Confirm email" (Auth → Providers → Email). `AGENT_MOCK=true` (default in `.env.example`) simulates the agent locally, because the H cloud browser cannot reach localhost. All variables are listed in [.env.example](.env.example).

## Scripts

| Command | What |
|---|---|
| `npm run test:receipts` | Receipt interpretation cases (no network) |
| `npm run eval:extract -- --cached` | Extraction eval on `tickets/`, replays saved transcripts (free) |
| `npm run eval:identify` | Product identification eval (`-- --linkup-cached` replays paid answers) |
| `npm run spike -- <contact_url>` | Dry-run the H agent on any brand form (never submits) |
| `npm run demo -- snapshot \| reset` | Save or restore the jury demo template account |
| `npm run stripe:demo-account` | Create the demo Stripe Connect test account |
| `npm run lint && npm run typecheck` | Run before every push |

