// OWNER: Dev 2.
import { CLAIM_STATUS_LABELS_FR, type ClaimStatus } from "@/lib/shared/types";

const COLORS: Record<ClaimStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  submitting: "bg-blue-100 text-blue-800 animate-pulse",
  submitted: "bg-indigo-100 text-indigo-800",
  waiting_input: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  refused: "bg-red-100 text-red-800",
  agent_failed: "bg-red-100 text-red-800",
  needs_manual: "bg-amber-100 text-amber-800",
  cancelled: "bg-neutral-100 text-neutral-500",
};

export function StatusBadge({ status, dryRun }: { status: ClaimStatus; dryRun?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
        {CLAIM_STATUS_LABELS_FR[status]}
      </span>
      {dryRun && status === "submitted" && (
        <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500">Test</span>
      )}
    </span>
  );
}
