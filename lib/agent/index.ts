// OWNER: Dev 2. Real H Company agent integration. Design: ARCHITECTURE.md §5.
//
// TODO(dev2), in this order:
// 1. buildComplaintText(claim, lineItem, receipt): French, FACTS ONLY (CLAUDE.md rule 1), via lib/shared/llm.ts
// 2. buildInstruction(...): the template in ARCHITECTURE.md §5.2, honoring flags.agentDryRun()
// 3. startSession(...): create the session with the `hai-agents` SDK, start_url = brand contact_url,
//    receipt image in `files`, answer schema = AgentAnswerSchema. Store h_session_id + agent_view_url.
//    Verify the exact SDK method names in hub.hcompany.ai/agents-api before writing the code.
// 4. mapOutcome(session): ARCHITECTURE.md §5.3 → transitionClaim(...)
import "server-only";

export {};
