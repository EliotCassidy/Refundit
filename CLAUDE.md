# Refundit: Claude Code instructions

Refundit is a mobile-first web app. A user photographs a supermarket receipt, picks the products that had a **real** problem, and an H Company computer-use agent files the complaint on each brand's customer-service contact form. Brand replies come back to a dedicated inbound address per claim and update the claim's status.

Hackathon project: 2 devs, 1 weekend. **Working end-to-end demo > completeness.**

## Read before working
- [ARCHITECTURE.md](ARCHITECTURE.md): components, data flows, agent and email design.
- [API_CONTRACTS.md](API_CONTRACTS.md): DB schema, shared types, endpoints. **This is the source of truth.**
- [TEAM.md](TEAM.md): who owns which files. **Don't edit files owned by the other dev.**
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): priorities and milestones.

## Stack
Next.js (App Router) + TypeScript (strict) · Supabase (Postgres, Auth, Storage) · Vercel · H Company Agents API (`hai-agents` TS SDK) · Resend Inbound · Linkup (unknown-brand lookup) · one LLM provider behind `lib/shared/llm.ts`.

## Non-negotiable rules
1. **Honest claims only.** The complaint text may only contain facts the user provided (product, issue, description, receipt data). Never invent defects, quantities, dates or details. The agent prompt must forbid making up any field.
2. **Contracts first.** Changing the DB schema, `lib/shared/types.ts` or an endpoint shape means updating `API_CONTRACTS.md` in the same commit, plus a heads-up to the other dev.
3. **Ownership.** Stay inside your folders (see TEAM.md). Shared files (`lib/shared/**`, `supabase/migrations/**`, `package.json`) get small, single-purpose commits.
4. **Only Dev 2's code changes `claims.status` after `draft`.** Use `lib/claims/transition.ts`; never update the status directly.
5. **`AGENT_DRY_RUN=true` by default in dev.** The agent stops before the final submit. Only set it to false for verified demo runs. Don't spam real brands.
6. **Don't invent external API behavior.** For H, Resend, Linkup, Gladia and the LLM, check the official docs before using an endpoint or field. If something is unverified, say so in a code comment.
7. No new infrastructure (queues, extra services, ORMs) without both devs agreeing. Supabase JS client + generated types only.

## Conventions
- Money is in integer cents (`*_cents`); dates are ISO strings; IDs are UUIDs.
- DB types are generated with `npx supabase gen types typescript` → `lib/shared/database.types.ts`. Never hand-edit that file.
- Server-only secrets never go in `NEXT_PUBLIC_*` env vars. Service-role Supabase client only in route handlers and server code.
- The UI targets phone width first (375px). The UI is in French.
- Validate external input (webhooks, LLM output) with zod.
- Prefer server components + route handlers; client components only where interaction needs them.

## Commands
- `npm run dev`: local app
- `npm run lint && npm run typecheck`: run before every push
- `npm run db:push`: apply migrations to the hackathon project (`--remote`; CLI v3 defaults to local Docker)
- `npm run seed`: seed brands + demo data
- `npm run db:types`: regenerate `lib/shared/database.types.ts` after a migration
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
