# Refundit: Claude Code instructions

Refundit is a mobile-first web app. A user photographs a supermarket receipt, picks the products that had a **real** problem, and an H Company computer-use agent files the complaint on each brand's customer-service contact form. Brand replies come back to a dedicated inbound address per claim and update the claim's status.

Hackathon project: 2 devs, 1 weekend. **Working end-to-end demo > completeness.**

## Read before working
- [ARCHITECTURE.md](ARCHITECTURE.md): components, data flows, agent and email design.
- [API_CONTRACTS.md](API_CONTRACTS.md): DB schema, shared types, endpoints. **This is the source of truth.**
- [TEAM.md](TEAM.md): who owns which files. **Don't edit files owned by the other dev.**
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): priorities and milestones.

## Current state (keep short; update it when it changes)
- **Receipt → product (Dev 1, done):** `POST /api/receipts` parses the photo with the H model (~5–20 s). `POST /api/receipts/:id/identify` handles one item per call (~1–8 s, one short LLM call, no Linkup): Open Food Facts / Open Beauty Facts candidates ranked against the receipt label, format and Open Prices. `POST /api/receipts/:id/confirm` takes an `ean` that must be one of the proposed candidates, or `null` ("je ne trouve pas mon produit" → `not_found`). Confirmations feed the shared `product_matches` cache.
- **Receipt pages (Dev 1, done):** `/receipts/new` (photo downsized in the browser), `/receipts/[id]` (items as printed), `/receipts/[id]/select` (issue + product choice, "je ne trouve pas mon produit", honesty checkbox). **`POST /api/claims` now returns `400 product_not_confirmed`** for any item whose `confirmed_product` is null: code or tests that create claims from seed data must call `/confirm` first (or set `confirmed_product` to `{"status":"not_found"}`).
- **Still TODO (Dev 1):** onboarding and profile pages.
- **Missing info (Dev 2, done):** DLC/DDM, batch number, "do you still have the product?" are asked after submission through `waiting_input` (`claims.missing_fields` / `user_answers`, `POST /api/claims/:id/answers`). The selection page does not ask for them.
- **Demo brands (Dev 2 spike):** Coca-Cola and Lu work through the web form; Evian goes through the email fallback; Bonne Maman goes through the missing-info flow; Pringles is not automatable (`needs_manual`).

## Stack
Next.js (App Router) + TypeScript (strict) · Supabase (Postgres, Auth, Storage) · Vercel · H Company Agents API (`hai-agents` TS SDK) · Gmail (SMTP + IMAP, one dedicated account, per-claim plus addresses) · Linkup (unknown-brand lookup) · one LLM provider behind `lib/shared/llm.ts`: the H Models API (OpenAI-compatible, `LLM_URL` / `LLM_MODEL` / `LLM_API_KEY`, default `holo4-35b-a3b`). Change the model in the env, never in code. Thinking is turned off with `chat_template_kwargs.enable_thinking=false` (`holo4-35b-a3b` ignores `reasoning_effort`).

## Non-negotiable rules
1. **Honest claims only.** The complaint text may only contain facts the user provided (product, issue, description, receipt data). Never invent defects, quantities, dates or details. The agent prompt must forbid making up any field.
2. **Contracts first.** Changing the DB schema, `lib/shared/types.ts` or an endpoint shape means updating `API_CONTRACTS.md` in the same commit, plus a heads-up to the other dev.
3. **Ownership.** Stay inside your folders (see TEAM.md). Shared files (`lib/shared/**`, `supabase/migrations/**`, `package.json`) get small, single-purpose commits.
4. **Only Dev 2's code changes `claims.status` after `draft`.** Use `lib/claims/transition.ts`; never update the status directly.
5. **`AGENT_DRY_RUN=true` by default in dev.** The agent stops before the final submit. Only set it to false for verified demo runs. Don't spam real brands.
6. **Don't invent external API behavior.** For H, Gmail, Linkup, Gladia and the LLM, check the official docs before using an endpoint or field. If something is unverified, say so in a code comment.
7. No new infrastructure (queues, extra services, ORMs) without both devs agreeing. Supabase JS client + generated types only.
8. **Product identity comes only from `line_items.confirmed_product`** (API_CONTRACTS §2, §5). It is NULL until the user validates a product.
   - `status: "confirmed"`: use its `name`, `brand`, `ean` (mirrored in `product_name`, `brand_name_guess`, `ean`).
   - `status: "not_found"` or `null`: the claim goes out marked **"produit non identifié"**. Quote `raw_label` as printed; never state a brand or an EAN.
   - Before confirmation `product_name` is just `raw_label`. Never present `raw_label`, `product_candidates` or the LLM's `llm_guess` as the identified product.
9. **API calls cost credits** (H models, Linkup). No loops or batches of paid calls without asking. Linkup credit is shared by brand lookup and product search: never retry it automatically. Measure receipt-parser changes with `npm run eval:extract -- --cached` (no model call).

## Conventions
- Money is in integer cents (`*_cents`); dates are ISO strings; IDs are UUIDs.
- DB types are generated with `npx supabase gen types typescript` → `lib/shared/database.types.ts`. Never hand-edit that file.
- Server-only secrets never go in `NEXT_PUBLIC_*` env vars. Service-role Supabase client only in route handlers and server code.
- The UI targets phone width first (375px). The UI is in French.
- Validate external input (webhooks, LLM output) with zod.
- Prefer server components + route handlers; client components only where interaction needs them.
- Vercel rejects request bodies over 4.5 MB: downsize photos in the browser before uploading them.

## Commands
- `npm run dev`: local app
- `npm run lint && npm run typecheck`: run before every push
- `npm run db:push`: apply migrations to the hackathon project (`--remote`; CLI v3 defaults to local Docker)
- `npm run seed`: seed brands + demo data
- `npm run db:types`: regenerate `lib/shared/database.types.ts` after a migration
- `npm run test:receipts`: receipt interpretation cases (no network, no model)
- `npm run eval:extract [-- --cached | --runs N | --only id1,id2]`: receipt extraction eval on `tickets/` (`--cached` = saved transcripts, no model call)
- `npm run spike -- <contact_url> [--brand X] [--agent h/web-surfer-pro] [--receipt file.jpg]`: dry-run the H agent on a brand form (never submits)

## Next.js 16 notes
- This Next version differs from older training data. Read `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).
- Middleware is called **proxy** (`proxy.ts`). `params` and `searchParams` are Promises: use the global `PageProps<"/route">`, `LayoutProps` and `RouteContext<"/route">` helpers.
- `cacheComponents` is **off** on purpose (cookie-based auth everywhere).

## Git
Both devs work **directly on `main`**, each in their own folders (TEAM.md):
- `git pull --rebase` before starting and before every push. Commit and push small and often (at least hourly).
- Run `npm run lint && npm run typecheck` before pushing. Never push a broken build; Vercel deploys `main`.
- Commit messages are prefixed `[dev1]`, `[dev2]` or `[shared]`. Never force-push.
