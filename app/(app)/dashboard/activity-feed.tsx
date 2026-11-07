"use client";
// Activity feed: every claim, grouped by day, banking-app style. Animated segmented filter + sort.
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { formatEuros } from "@/components/ui/brand";
import { SortMenu } from "@/components/ui/sort-menu";
import { StaggerItem } from "@/components/ui/motion";
import { STATUS_GROUP, STATUS_LABEL, type StatusGroup } from "@/components/ui/status";
import { ISSUE_LABELS_FR, type ClaimStatus, type IssueType } from "@/lib/shared/types";

export type FeedClaim = {
  id: string;
  status: ClaimStatus;
  issueType: IssueType;
  refundCents: number | null;
  stakeCents: number;
  product: string;
  brand: string | null;
  updatedAt: string;
};

type Filter = "all" | StatusGroup;
type Sort = "recent" | "oldest" | "amount";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "action", label: "À faire" },
  { id: "progress", label: "En cours" },
  { id: "done", label: "Remboursé" },
  { id: "stopped", label: "Refusé" },
];

const AVATAR: Record<StatusGroup, string> = {
  done: "bg-brand-soft text-on-brand-soft",
  progress: "bg-info-soft text-on-info-soft",
  action: "bg-warning-soft text-on-warning-soft",
  stopped: "bg-danger-soft text-on-danger-soft",
};
const DOT: Record<StatusGroup, string> = { done: "bg-brand", progress: "bg-info", action: "bg-warning", stopped: "bg-danger" };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Aujourd'hui";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function ActivityFeed({ claims }: { claims: FeedClaim[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("fr-FR");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: claims.length, action: 0, progress: 0, done: 0, stopped: 0 };
    for (const cl of claims) c[STATUS_GROUP[cl.status]]++;
    return c;
  }, [claims]);

  const groups = useMemo(() => {
    const matches = (c: FeedClaim) =>
      !q || [c.product, c.brand ?? "", STATUS_LABEL[c.status], ISSUE_LABELS_FR[c.issueType]].join(" ").toLocaleLowerCase("fr-FR").includes(q);
    const list = (filter === "all" ? [...claims] : claims.filter((c) => STATUS_GROUP[c.status] === filter)).filter(matches).sort((a, b) =>
      sort === "amount"
        ? (b.refundCents ?? b.stakeCents) - (a.refundCents ?? a.stakeCents)
        : sort === "oldest"
          ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
    if (sort === "amount") return [{ label: "Par montant", items: list }];
    const map = new Map<string, { label: string; items: FeedClaim[] }>();
    for (const c of list) {
      const k = dayKey(c.updatedAt);
      if (!map.has(k)) map.set(k, { label: dayLabel(c.updatedAt), items: [] });
      map.get(k)!.items.push(c);
    }
    return [...map.values()];
  }, [claims, filter, sort, q]);

  let index = 0;
  return (
    <section id="activite" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Activité</h2>
        <SortMenu
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Plus récentes" },
            { value: "oldest", label: "Plus anciennes" },
            { value: "amount", label: "Montant", hint: "Du plus élevé au plus bas" },
          ]}
        />
      </div>

      {/* Search */}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit, une marque, un statut…"
          aria-label="Rechercher dans l'activité"
          className="h-11 w-full rounded-full border border-white/80 bg-white/60 pl-10 pr-10 text-[15px] text-ink outline-none backdrop-blur-xl transition placeholder:text-muted focus:border-ink/30 focus:bg-white [&::-webkit-search-cancel-button]:hidden"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-ink/80 text-surface"
            >
              <X className="size-3.5" strokeWidth={2.5} aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>
      </label>

      {/* Segmented control with a sliding pill */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-1 rounded-full border border-white/70 bg-white/45 p-1 backdrop-blur-xl" role="tablist" aria-label="Filtrer">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className="relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium"
            >
              {filter === id && (
                <motion.span layoutId="feed-pill" className="absolute inset-0 rounded-full bg-raised shadow-[0_1px_3px_rgba(17,23,20,0.12)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className={`relative ${filter === id ? "text-ink" : "text-muted"}`}>
                {label}
                {counts[id] > 0 && <span className="ml-1.5 text-xs opacity-60">{counts[id]}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {groups.length === 0 ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center text-sm text-muted">
            {q ? <>Aucun résultat pour « {query.trim()} ».</> : <>Rien ici pour l&apos;instant.</>}
          </motion.p>
        ) : (
          groups.map((g) => (
            <motion.div key={`${filter}-${sort}-${g.label}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted first-letter:uppercase">{g.label}</h3>
              <ul className="overflow-hidden rounded-[20px] border border-white/70 bg-white/60 shadow-[0_12px_32px_-12px_rgba(17,23,20,0.1)] backdrop-blur-xl backdrop-saturate-150">
                {g.items.map((c, i) => {
                  const group = STATUS_GROUP[c.status];
                  const refunded = c.refundCents != null;
                  return (
                    <StaggerItem key={c.id} index={index++} className={i ? "border-t border-black/[0.05]" : ""}>
                      <Link href={`/claims/${c.id}`} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/60 active:bg-white/80">
                        <span className={`relative grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-bold ${AVATAR[group]}`}>
                          {(c.brand ?? c.product).charAt(0).toUpperCase()}
                          <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white ${DOT[group]} ${c.status === "submitting" ? "animate-pulse" : ""}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{c.product}</span>
                          <span className="block truncate text-[13px] text-muted">
                            {(refunded && c.status === "accepted" ? "Remboursée" : STATUS_LABEL[c.status])} · {c.brand ?? ISSUE_LABELS_FR[c.issueType]}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className={`money text-[15px] ${refunded ? "text-brand-strong" : "text-ink"}`}>
                            {refunded ? `+${formatEuros(c.refundCents!)}` : formatEuros(c.stakeCents)}
                          </span>
                          <span className="text-xs text-muted">{refunded ? "reçu" : "en jeu"} · {time(c.updatedAt)}</span>
                        </span>
                      </Link>
                    </StaggerItem>
                  );
                })}
              </ul>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </section>
  );
}
