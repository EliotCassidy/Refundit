"use client";
// OWNER: Dev 2. Compact Agent View: thumbnail + last action + live dot + Stop.
// "Voir en grand" opens a lightbox (full screenshot, replay slider, action log).
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

type Step = { at: string; kind: string; text: string | null; screenshot: string | null; pageUrl: string | null };

export function AgentView({ claimId, live, actions }: { claimId: string; live: boolean; actions?: ReactNode }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch(`/api/claims/${claimId}/agent`).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (stop) return;
      if (!res?.ok) setError(json?.error?.message ?? "Agent View indisponible");
      else setSteps(json.steps ?? []);
    }
    load();
    const timer = live ? setInterval(load, 3000) : null;
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [claimId, live]);

  const shots = steps.filter((s) => s.screenshot);
  const log = steps.filter((s) => s.kind === "action" || s.kind === "error");
  const last = shots.at(-1) ?? null;
  const lastAction = log.at(-1)?.text ?? (live ? "Ouverture du navigateur…" : null);

  return (
    <section className="rounded-[20px] border border-line bg-raised/90 p-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => last && setOpen(true)}
          disabled={!last}
          aria-label="Voir l'écran de l'agent en grand"
          className="group relative h-[72px] w-24 shrink-0 overflow-hidden rounded-[12px] border border-line bg-sunken"
        >
          {last?.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy route
            <img src={last.screenshot} alt="" className="size-full object-cover object-top transition group-hover:scale-105" />
          ) : (
            <span className="grid size-full place-items-center text-muted"><Bot className="size-6" aria-hidden /></span>
          )}
          {last && (
            <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <Maximize2 className="size-4 text-white" aria-hidden />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {live ? (
              <>
                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-danger" /></span>
                L&apos;agent travaille
              </>
            ) : (
              <>Agent · {shots.length} écran{shots.length > 1 ? "s" : ""}</>
            )}
          </p>
          <AnimatePresence mode="wait">
            <motion.p key={lastAction ?? error ?? "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-0.5 truncate text-[13px] text-muted">
              {error ?? lastAction ?? "Aucune action enregistrée"}
            </motion.p>
          </AnimatePresence>
          {last && (
            <button type="button" onClick={() => setOpen(true)} className="mt-1 text-[13px] font-semibold text-ink underline-offset-2 hover:underline">
              {live ? "Regarder en direct" : "Revoir le parcours"}
            </button>
          )}
        </div>
      </div>

      {actions && <div className="mt-3">{actions}</div>}

      <AnimatePresence>{open && <Lightbox shots={shots} log={log} live={live} onClose={() => setOpen(false)} />}</AnimatePresence>
    </section>
  );
}

function Lightbox({ shots, log, live, onClose }: { shots: Step[]; log: Step[]; live: boolean; onClose: () => void }) {
  const [index, setIndex] = useState<number | null>(null); // null = follow latest
  const current = index ?? shots.length - 1;
  const shot = shots[Math.max(0, Math.min(current, shots.length - 1))];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, (i ?? shots.length - 1) - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(shots.length - 1, (i ?? shots.length - 1) + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, shots.length]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#111714]/60 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Écran de l'agent"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[24px] bg-raised shadow-2xl sm:rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="mono min-w-0 flex-1 truncate rounded-full bg-sunken px-3 py-1.5 text-xs text-muted">{shot?.pageUrl ?? "—"}</span>
          {live && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">EN DIRECT</span>}
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full hover:bg-sunken"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-sunken">
          {shot?.screenshot && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy route
            <img src={shot.screenshot} alt="Écran du navigateur de l'agent" className="mx-auto w-full max-w-2xl bg-white" />
          )}
        </div>
        {shots.length > 1 && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <button type="button" onClick={() => setIndex(Math.max(0, current - 1))} aria-label="Écran précédent" className="grid size-9 place-items-center rounded-full border border-line hover:bg-sunken"><ChevronLeft className="size-4" aria-hidden /></button>
            <input type="range" min={0} max={shots.length - 1} value={current} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Parcourir le replay" className="flex-1 accent-[var(--ink)]" />
            <button type="button" onClick={() => setIndex(Math.min(shots.length - 1, current + 1))} aria-label="Écran suivant" className="grid size-9 place-items-center rounded-full border border-line hover:bg-sunken"><ChevronRight className="size-4" aria-hidden /></button>
            <span className="mono w-12 text-right text-xs text-muted">{current + 1}/{shots.length}</span>
          </div>
        )}
        {log.length > 0 && (
          <ol className="max-h-28 overflow-y-auto border-t border-line px-4 py-2.5 text-xs text-muted">
            {[...log].reverse().slice(0, 30).map((a, k) => (
              <li key={k} className="truncate py-0.5">› {a.text}</li>
            ))}
          </ol>
        )}
      </motion.div>
    </motion.div>
  );
}
