"use client";
// Every claim, filterable by status group and sortable. Cards on mobile, rows on desktop.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Money } from "@/components/ui/brand";
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
const STATUS_ORDER: StatusGroup[] = ["action", "progress", "done", "stopped"];

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

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
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Toutes mes demandes</h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          Trier
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full border border-line-strong/60 bg-raised px-3 py-1.5 text-sm font-semibold text-ink"
          >
            <option value="recent">Plus récentes</option>
            <option value="amount">Montant</option>
            <option value="status">Statut</option>
          </select>
        </label>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Filtrer par statut">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              filter === f ? "bg-ink text-surface" : "border border-line bg-raised text-muted hover:text-ink"
            }`}
          >
            {f === "all" ? "Toutes" : GROUP_LABEL[f]} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-line-strong/50 p-6 text-center text-sm text-muted">Aucune demande ici.</p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-[24px] border border-line bg-raised">
          {shown.map((c, i) => (
            <li key={c.id} className={i ? "border-t border-line" : ""}>
              <Link
                href={`/claims/${c.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 transition hover:bg-sunken md:grid-cols-[1fr_170px_110px_80px] md:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.product}</p>
                  <p className="truncate text-sm text-muted">{[c.brand, ISSUE_LABELS_FR[c.issueType]].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="col-start-1 row-start-2 md:col-start-2 md:row-start-1">
                  <StatusBadge status={c.status} refunded={c.refundCents != null} dryRun={c.dryRun} />
                </div>
                <div className="col-start-2 row-span-2 row-start-1 text-right md:col-start-3 md:row-span-1">
                  {c.refundCents != null ? (
                    <Money cents={c.refundCents} className="text-brand-strong" />
                  ) : (
                    <Money cents={c.stakeCents} className="text-muted" />
                  )}
                </div>
                <span className="hidden text-right text-sm text-muted md:block">{dateFmt.format(new Date(c.updatedAt))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
