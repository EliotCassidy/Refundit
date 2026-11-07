// Shared UI. Claim statuses grouped as in the design guide §4:
// Remboursé (green) · En cours (blue) · Besoin de toi (amber) · Refusé / Stop (red).
import type { ClaimStatus } from "@/lib/shared/types";

export type StatusGroup = "done" | "progress" | "action" | "stopped";

export const STATUS_GROUP: Record<ClaimStatus, StatusGroup> = {
  draft: "progress",
  submitting: "progress",
  submitted: "progress",
  waiting_input: "action",
  needs_manual: "action",
  agent_failed: "action",
  accepted: "done",
  refused: "stopped",
  cancelled: "stopped",
};

export const GROUP_LABEL: Record<StatusGroup, string> = {
  done: "Remboursées",
  progress: "En cours",
  action: "Besoin de toi",
  stopped: "Refusées / arrêtées",
};

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "Brouillon",
  submitting: "L'agent travaille",
  submitted: "Envoyée",
  waiting_input: "Infos demandées",
  needs_manual: "À faire toi-même",
  agent_failed: "Échec · à relancer",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Arrêtée",
};

const GROUP_STYLE: Record<StatusGroup, { badge: string; dot: string }> = {
  done: { badge: "bg-brand-soft text-on-brand-soft", dot: "bg-brand" },
  progress: { badge: "bg-info-soft text-on-info-soft", dot: "bg-info" },
  action: { badge: "bg-warning-soft text-on-warning-soft", dot: "bg-warning" },
  stopped: { badge: "bg-danger-soft text-on-danger-soft", dot: "bg-danger" },
};

export function StatusBadge({ status, refunded, dryRun }: { status: ClaimStatus; refunded?: boolean; dryRun?: boolean }) {
  const group = STATUS_GROUP[status];
  const s = GROUP_STYLE[group];
  const label = status === "accepted" && refunded ? "Remboursée" : STATUS_LABEL[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.badge}`}>
        <span className={`size-1.5 rounded-full ${s.dot} ${status === "submitting" ? "animate-pulse" : ""}`} />
        {label}
      </span>
      {dryRun && status === "submitted" && (
        <span className="rounded-full border border-line-strong/50 px-2 py-0.5 text-[11px] font-medium text-muted">Test</span>
      )}
    </span>
  );
}

export const groupDot = (g: StatusGroup) => GROUP_STYLE[g].dot;
