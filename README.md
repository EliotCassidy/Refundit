# Refundit

Snap a receipt, pick the product that had a problem, and an AI agent files the complaint on the brand's contact form.

Start with [CLAUDE.md](CLAUDE.md), then [ARCHITECTURE.md](ARCHITECTURE.md), [API_CONTRACTS.md](API_CONTRACTS.md), [TEAM.md](TEAM.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Setup (once)
1. `npm install`
2. Create a Supabase project. In Auth → Providers → Email, **disable "Confirm email"**.
3. `cp .env.example .env.local` and fill in the Supabase keys, `INTERNAL_API_KEY` and `SEED_DEMO_PASSWORD`.
4. Link the project and apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   npm run db:types      # regenerates lib/shared/database.types.ts
   npm run seed
   ```
5. `npm run dev` → http://localhost:3000 (log in with the seed demo user).

With `AGENT_MOCK=true` (default in `.env.example`), submitting a claim simulates an agent run: `submitting`, then `submitted` after ~10s once `/api/claims/:id/sync` is called.
