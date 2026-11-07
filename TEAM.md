# Team & ownership

The rule of thumb: **Dev 1 owns everything up to the "Envoyer les réclamations" button. Dev 2 owns everything after it.**

## Dev 1: User flow, receipts & brands
**Pages:** login/signup, onboarding, profile, home ("scan a receipt"), receipt upload, parsed receipt, item & issue selection.

**Backend:**
- `/api/receipts` (upload + parse)
- `/api/claims` (create drafts + trigger submit)
- receipt parser and LLM choice (`lib/shared/llm.ts`)
- brand registry: seed data, `resolveBrand`, `getBrandContact` with Linkup

**Also:** repo scaffold, Supabase project + auth, the shared UI kit and app layout/navigation.

**P2:** Gladia voice description for "other" issues (check Gladia's docs first).

**Owns:**
```
app/(auth)/**            app/(app)/onboarding/**   app/(app)/profile/**
app/(app)/page.tsx       app/(app)/receipts/**
app/api/receipts/**      app/api/claims/route.ts
lib/receipts/**          lib/brands/**              supabase/seed/**
components/ui/**         app/layout.tsx, app/(app)/layout.tsx, proxy.ts
```

## Dev 2: Agent, claim lifecycle, email & tracking
**Pages:** claims dashboard (list + status badges) and claim detail (complaint text, Agent View, Cancel / Retry, email timeline).

**Backend:**
- complaint text generation
- H session creation, H webhook + `/sync`, outcome mapping
- the claim state machine
- Resend inbound webhook, reply classification
- `AGENT_MOCK` stub
- the H and Resend spikes

**Owns:**
```
app/(app)/claims/**                  app/api/claims/[id]/**
app/api/webhooks/**                  lib/agent/**
lib/claims/**                        lib/email/**
```

## Shared (coordinate before changing)
```
lib/shared/**  (types.ts, database.types.ts, supabase clients, llm.ts)
supabase/migrations/**   package.json   .env.example   API_CONTRACTS.md
```
- Make **small, single-purpose commits** to shared files and push them right away. Don't keep shared-file edits uncommitted.
- `lib/shared/llm.ts` is created by Dev 1. Dev 2 may *add* functions, but must not change existing signatures without a heads-up.
- Adding a dependency: commit `package.json` + lockfile alone, push to `main`, and tell the other dev to `npm i`.

## Interfaces between you
1. **DB schema + enums** (API_CONTRACTS §1–2), written together at kickoff in `0001_init`.
2. **`POST /api/claims/:id/submit`**: Dev 1 calls it, Dev 2 implements it.
3. **`getBrandContact()`**: Dev 2 calls it, Dev 1 implements it.
4. **`lib/shared/llm.ts`**: Dev 1 implements it, both use it.
5. **Navigation**: Dev 1's layout links to `/claims` and `/claims/[id]`. After submit, Dev 1 redirects to `/claims`.

Until each side is real, unblock yourself with stubs:
- Dev 1 uses `AGENT_MOCK=true`.
- Dev 2 uses `npm run seed`, which inserts a fake profile, receipt, line items and brands, plus a hard-coded `getBrandContact` stub that Dev 1 replaces.

## Git workflow (everyone on `main`)
- No feature branches. Folder ownership is what prevents conflicts.
- Loop: `git pull --rebase` → work → `npm run lint && npm run typecheck` → commit → `git pull --rebase` → `git push`.
- Push small commits often (at least hourly) so the other dev never rebases over a big diff.
- Commit messages: `[dev1] receipt upload page`, `[dev2] H webhook`, `[shared] add claim_events index`.
- `main` must always build: Vercel deploys every push.
- Conflict on a shared file → whoever pulls second resolves it, and asks if unsure. Never force-push.

## Claude Code usage
- Each dev runs their own sessions, scoped to their folders. Start each session with: "I am Dev N, read CLAUDE.md and TEAM.md."
- When a session needs a contract change, it stops and proposes the change to API_CONTRACTS.md rather than working around it.
- Devin (sponsor) can take well-isolated tasks: seed script, zod schemas, UI polish. Give it the relevant contract section.

## Sync points (15 min, out loud)
Saturday kickoff (contracts) · after the spike (H+2) · Saturday evening (integration) · Sunday morning (demo freeze plan) · before recording.
