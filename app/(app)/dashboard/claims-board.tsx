"use client";
// Every claim: segmented filter by status group + sort. Table on desktop, list on mobile.
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/ui/brand";
import { shortDate } from "@/components/ui/format";
import { GROUP_LABEL, STATUS_GROUP, StatusBadge, type StatusGroup } from "@/components/ui/status";
import { ISSUE_LABELS_FR, type ClaimStatus, type IssueType } from "@/lib/shared/types";

export type BoardClaim = {
  id: string;
  status: ClaimStatus;
  issueType: IssueType;
  dryRun: boolean;
  missingFields: string[];
  refundCents: number | null;
  stakeCents: number;
  product: string;
  brand: string | null;
  store: string | null;
  updatedAt: string;
};

type Filter = "all" | StatusGroup;
type Sort = "recent" | "amount" | "status";
const FILTERS: Filter[] = ["all", "action", "progress", "done", "stopped"];
const SHORT: Record<Filter, string> = { all: "Toutes", action: "À faire", progress: "En cours", done: "Remboursées", stopped: "Refusées" };
const STATUS_ORDER: StatusGroup[] = ["action", "progress", "done", "stopped"];

export function ClaimsBoard({ claims }: { claims: BoardClaim[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: claims.length, action: 0, progress: 0, done: 0, stopped: 0 };
    for (const cl of claims) c[STATUS_GROUP[cl.status]]++;
    return c;
  }, [claims]);

  const shown = useMemo(() => {
    const list = filter === "all" ? [...claims] : claims.filter((c) => STATUS_GROUP[c.status] === filter);
    if (sort === "amount") list.sort((a, b) => (b.refundCents ?? b.stakeCents) - (a.refundCents ?? a.stakeCents));
    else if (sort === "status") list.sort((a, b) => STATUS_ORDER.indexOf(STATUS_GROUP[a.status]) - STATUS_ORDER.indexOf(STATUS_GROUP[b.status]));
    else list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [claims, filter, sort]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Mes demandes</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Trier les demandes"
          className="rounded-[10px] border border-line bg-raised px-3 py-1.5 text-sm font-medium text-ink outline-none focus:border-line-strong"
        >
          <option value="recent">Plus récentes</option>
          <option value="amount">Montant</option>
          <option value="status">Statut</option>
        </select>
      </div>

      {/* Segmented control */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-1 rounded-[12px] bg-sunken p-1" role="tablist" aria-label="Filtrer par statut">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              title={f === "all" ? "Toutes" : GROUP_LABEL[f]}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-[9px] px-3 py-1.5 text-sm font-medium transition ${
                filter === f ? "bg-raised text-ink shadow-[0_1px_2px_rgba(17,23,20,0.08)]" : "text-muted hover:text-ink"
              }`}
            >
              {SHORT[f]}
              <span className={`ml-1.5 text-xs ${filter === f ? "text-muted" : "opacity-60"}`}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-line-strong/40 p-8 text-center text-sm text-muted">Aucune demande ici.</p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-raised">
          <div className="hidden grid-cols-[1fr_150px_100px_70px_20px] gap-4 border-b border-line px-5 py-2.5 text-xs font-medium text-muted md:grid">
            <span>Produit</span><span>Statut</span><span className="text-right">Montant</span><span className="text-right">Mis à jour</span><span />
          </div>
          <ul>
            {shown.map((c, i) => (
              <li key={c.id} className={i ? "border-t border-line" : ""}>
                <Link
                  href={`/claims/${c.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 transition hover:bg-sunken/40 md:grid-cols-[1fr_150px_100px_70px_20px] md:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{c.product}</p>
                    <p className="truncate text-[13px] text-muted">{[c.brand, ISSUE_LABELS_FR[c.issueType]].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="col-start-1 row-start-2 md:col-start-2 md:row-start-1">
                    <StatusBadge status={c.status} refunded={c.refundCents != null} dryRun={c.dryRun} />
                  </div>
                  <div className="col-start-2 row-span-2 row-start-1 text-right md:col-start-3 md:row-span-1">
                    {c.refundCents != null ? (
                      <Money mono cents={c.refundCents} className="text-[15px] text-brand-strong" />
                    ) : (
                      <Money mono cents={c.stakeCents} className="text-[15px] text-muted" />
                    )}
                  </div>
                  <span className="hidden text-right text-[13px] text-muted md:block">{shortDate(c.updatedAt)}</span>
                  <ChevronRight className="hidden size-4 text-line-strong md:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
