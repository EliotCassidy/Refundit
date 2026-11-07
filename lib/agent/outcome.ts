// OWNER: Dev 2. H session result → claim status (ARCHITECTURE.md §5.3). Pure function.
import { AgentAnswerSchema, type ClaimStatus } from "@/lib/shared/types";
import type { TablesUpdate } from "@/lib/shared/database.types";

export type SessionSnapshot = {
  status: string; // H TrajectoryStatus
  errorCode?: string | null;
  error?: string | null;
  outcome?: string | null; // H AnswerOutcome: success | partial | infeasible | blocked
  latestAnswer?: unknown;
};

export type OutcomeDecision = {
  to: ClaimStatus;
  patch: Omit<TablesUpdate<"claims">, "status">;
  payload: Record<string, unknown>;
};

const TERMINAL = new Set(["completed", "failed", "timed_out", "interrupted"]);

/**
 * Observed in the spike: catalog agents (h/web-surfer-flash) can settle in "idle" after answering
 * instead of "completed". An idle session WITH an answer is treated as completed.
 */
export function isSettled(status: string, latestAnswer: unknown): boolean {
  return TERMINAL.has(status) || (status === "idle" && latestAnswer != null);
}

/** Returns null while the session is still running (or idle/paused). */
export function decideOutcome(s: SessionSnapshot, claimDryRun: boolean): OutcomeDecision | null {
  if (!isSettled(s.status, s.latestAnswer)) return null;
  const base = { h_status: s.status, h_outcome: s.outcome ?? null };

  if (s.status !== "completed" && s.status !== "idle") {
    const reason = s.errorCode ?? s.status;
    return { to: "agent_failed", patch: { failure_reason: reason }, payload: { ...base, error: s.error ?? null } };
  }

  const raw = typeof s.latestAnswer === "string" ? safeJson(s.latestAnswer) : s.latestAnswer;
  const parsed = AgentAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return { to: "agent_failed", patch: { failure_reason: "invalid_answer" }, payload: { ...base, raw: s.latestAnswer ?? null } };
  }
  const a = parsed.data;
  const payload = { ...base, answer: a };

  if (a.submitted) {
    // Already sent: we can't undo it, but guessed fields are recorded in the event payload.
    return { to: "submitted", patch: { confirmation_number: a.confirmation_number, failure_reason: null, dry_run: false }, payload };
  }
  if (a.blocker) {
    return { to: "needs_manual", patch: { failure_reason: `${a.blocker}: ${a.notes}`.slice(0, 500) }, payload };
  }
  if (claimDryRun) {
    // Form filled, stopped before the final click on purpose. Only counts if the self-checks pass.
    const problems = [
      !a.customer_email_entered && "customer email not entered",
      !a.submit_button_found && "final submit button not found",
      a.guessed_fields.length > 0 && `guessed fields: ${a.guessed_fields.join(", ")}`,
    ].filter(Boolean);
    if (problems.length) {
      return { to: "needs_manual", patch: { failure_reason: `form_incomplete: ${problems.join("; ")}`.slice(0, 500) }, payload };
    }
    return { to: "submitted", patch: { confirmation_number: null, failure_reason: null, dry_run: true }, payload };
  }
  return { to: "agent_failed", patch: { failure_reason: `not_submitted: ${a.notes}`.slice(0, 500) }, payload };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
