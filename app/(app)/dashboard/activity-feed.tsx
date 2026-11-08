"use client";
// Activity as "dossiers": one folder per purchase (store logo + purchase date). Tap a folder to open it
// and see the refund requests made from that receipt. Search, sort (Radix) and status filter still apply.
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { formatEuros } from "@/components/ui/brand";
import { SortMenu } from "@/components/ui/sort-menu";
import { StoreIcon } from "@/components/ui/store-logo";
import { STATUS_GROUP, STATUS_LABEL, type StatusGroup } from "@/components/ui/status";
import { ISSUE_LABELS_FR, type ClaimStatus, type IssueType } from "@/lib/shared/types";
import { findStore, type Store } from "@/lib/stores";

export type FeedClaim = {
  id: string;
  status: ClaimStatus;
  issueType: IssueType;
  refundCents: number | null;
  stakeCents: number;
  product: string;
  brand: string | null;
  updatedAt: string;
  receiptId: string;
  storeName: string | null;
  storeChain: string | null;
  purchasedAt: string | null;
  scannedAt: string;
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
const DOT: Record<StatusGroup, string> = { done: "bg-brand", progress: "bg-info", action: "bg-warning", stopped: "bg-danger" };
const PILL: Record<StatusGroup, string> = {
  done: "bg-brand-soft text-on-brand-soft",
  progress: "bg-info-soft text-on-info-soft",
  action: "bg-warning-soft text-on-warning-soft",
  stopped: "bg-danger-soft text-on-danger-soft",
};

type Folder = {
  id: string;
  store: Store | null;
  title: string;
  branch: string | null;
  date: string; // purchase date, or scan date when the receipt had none
  dateKnown: boolean;
  claims: FeedClaim[];
  refunded: number;
  stake: number;
};

const longDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function buildFolders(claims: FeedClaim[]): Folder[] {
  const map = new Map<string, Folder>();
  for (const c of claims) {
    let f = map.get(c.receiptId);
    if (!f) {
      const store = findStore(c.storeChain, c.storeName);
      const printed = c.storeName && store && !store.match.test(c.storeName.toLowerCase()) ? capitalize(c.storeName) : null;
      f = {
        id: c.receiptId,
        store,
        title: store?.name ?? (c.storeName ? capitalize(c.storeName) : "Ticket de caisse"),
        branch: printed,
        date: c.purchasedAt ?? c.scannedAt,
        dateKnown: c.purchasedAt != null,
        claims: [],
        refunded: 0,
        stake: 0,
      };
      map.set(c.receiptId, f);
    }
    f.claims.push(c);
    f.refunded += c.refundCents ?? 0;
    f.stake += c.stakeCents;
  }
  return [...map.values()];
}

export function ActivityFeed({ claims }: { claims: FeedClaim[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const q = query.trim().toLocaleLowerCase("fr-FR");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: claims.length, action: 0, progress: 0, done: 0, stopped: 0 };
    for (const cl of claims) c[STATUS_GROUP[cl.status]]++;
    return c;
  }, [claims]);

  const folders = useMemo(() => {
    const all = buildFolders(claims);
    const out: Folder[] = [];
    for (const f of all) {
      const storeText = [f.title, f.branch ?? ""].join(" ").toLocaleLowerCase("fr-FR");
      const visible = f.claims.filter((c) => {
        if (filter !== "all" && STATUS_GROUP[c.status] !== filter) return false;
        if (!q) return true;
        const text = [c.product, c.brand ?? "", STATUS_LABEL[c.status], ISSUE_LABELS_FR[c.issueType]].join(" ").toLocaleLowerCase("fr-FR");
        return text.includes(q) || storeText.includes(q);
      });
      if (visible.length) out.push({ ...f, claims: visible.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    }
    return out.sort((a, b) =>
      sort === "amount" ? (b.refunded || b.stake) - (a.refunded || a.stake) : sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
    );
  }, [claims, filter, sort, q]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section id="activite" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="px-1 text-[17px] font-semibold tracking-tight">Mes achats</h2>
        <SortMenu
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Plus récents", hint: "Date d'achat" },
            { value: "oldest", label: "Plus anciens", hint: "Date d'achat" },
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
          placeholder="Magasin, produit, marque…"
          aria-label="Rechercher dans mes achats"
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

      {folders.length === 0 ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center text-sm text-muted">
          {q ? <>Aucun résultat pour « {query.trim()} ».</> : <>Rien ici pour l&apos;instant.</>}
        </motion.p>
      ) : (
        <motion.ul layout className="flex flex-col gap-5 pt-2">
          <AnimatePresence initial={false}>
            {folders.map((f, i) => (
              <FolderCard key={f.id} folder={f} index={i} open={!!q || open.has(f.id)} onToggle={() => toggle(f.id)} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}

function FolderCard({ folder: f, index, open, onToggle }: { folder: Folder; index: number; open: boolean; onToggle: () => void }) {
  const n = f.claims.length;
  const sheets = Math.min(n, 2);
  const tone = f.store?.color ?? "#111714";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="relative isolate"
      data-demo-live={f.claims.some((c) => ["submitting", "waiting_input"].includes(c.status)) ? "" : undefined}
      data-claim-ids={f.claims.map((c) => c.id).join(" ")}
    >
      {/* Folder tab */}
      <span aria-hidden className="absolute -top-2.5 left-5 h-4 w-20 rounded-t-[10px] border border-b-0 border-white/80 bg-white/75 backdrop-blur-xl">
        <span className="absolute left-3 top-[5px] h-[3px] w-6 rounded-full" style={{ background: tone, opacity: 0.55 }} />
      </span>

      {/* Sheets peeking out of the closed folder, one per request (max 2) */}
      <AnimatePresence>
        {!open &&
          Array.from({ length: sheets }, (_, k) => (
            <motion.span
              key={k}
              aria-hidden
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: (k + 1) * 6 }}
              exit={{ opacity: 0, y: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-x-0 bottom-0 h-10 rounded-b-[22px] border border-white/70 bg-white/45 shadow-[0_6px_16px_-10px_rgba(17,23,20,0.2)] backdrop-blur"
              style={{ marginInline: (k + 1) * 10, zIndex: -1 - k }}
            />
          ))}
      </AnimatePresence>

      <div className="relative overflow-hidden rounded-[24px] bg-white/80 shadow-[0_1px_2px_rgba(17,23,20,0.04),0_12px_32px_-18px_rgba(17,23,20,0.18)] ring-1 ring-black/[0.05] backdrop-blur-xl">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-white/50">
          <StoreIcon store={f.store} fallbackName={f.title} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium">
              {f.title}
              {f.branch && <span className="font-normal text-muted"> · {f.branch}</span>}
            </span>
            <span className="block truncate text-[13px] text-muted">
              {f.dateKnown ? `Achat du ${longDate(f.date)}` : `Ticket scanné le ${longDate(f.date)}`}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <span className="flex -space-x-0.5">
                {f.claims.slice(0, 5).map((c) => (
                  <span key={c.id} className={`size-2 rounded-full ring-2 ring-white ${DOT[STATUS_GROUP[c.status]]} ${c.status === "submitting" ? "animate-pulse" : ""}`} />
                ))}
              </span>
              {n} demande{n > 1 ? "s" : ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className={`money text-[15px] ${f.refunded ? "text-brand-strong" : "text-ink"}`}>{f.refunded ? `+${formatEuros(f.refunded)}` : formatEuros(f.stake)}</span>
            <span className="flex items-center gap-1 text-xs text-muted">
              {f.refunded ? "reçu" : "en jeu"}
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                <ChevronDown className="size-4" aria-hidden />
              </motion.span>
            </span>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ul className="mx-3 mb-3 flex flex-col gap-2 rounded-[16px] bg-sunken/70 p-2">
                {f.claims.map((c, k) => {
                  const group = STATUS_GROUP[c.status];
                  const refunded = c.refundCents != null;
                  return (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0, y: -10, rotate: -0.6 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ delay: 0.06 + k * 0.05, type: "spring", stiffness: 380, damping: 30 }}
                    >
                      <Link
                        href={`/claims/${c.id}`}
                        className="group flex items-center gap-3 rounded-[12px] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(17,23,20,0.06)] transition hover:shadow-[0_6px_16px_-8px_rgba(17,23,20,0.25)] active:scale-[0.99]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{c.product}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[12px]">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${PILL[group]}`}>
                              <span className={`size-1.5 rounded-full ${DOT[group]} ${c.status === "submitting" ? "animate-pulse" : ""}`} />
                              {refunded && c.status === "accepted" ? "Remboursée" : STATUS_LABEL[c.status]}
                            </span>
                            <span className="truncate text-muted">{c.brand ?? ISSUE_LABELS_FR[c.issueType]}</span>
                          </span>
                        </span>
                        <span className={`money shrink-0 text-[15px] ${refunded ? "text-brand-strong" : "text-ink"}`}>
                          {refunded ? `+${formatEuros(c.refundCents!)}` : formatEuros(c.stakeCents)}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
