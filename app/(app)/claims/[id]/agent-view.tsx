"use client";
// OWNER: Dev 2. Agent View as one list row: thumbnail + last action + live dot (+ Stop below).
// "Voir en grand" opens a lightbox (full screenshot, replay slider, action log).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useDemoRaw } from "@/components/demo/demo-state";

type Step = { at: string; kind: string; text: string | null; screenshot: string | null; pageUrl: string | null };

export function AgentView({ claimId, live, actions }: { claimId: string; live: boolean; actions?: ReactNode }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Jury demo tour (components/demo): opens / closes the agent's screen on its own.
  useEffect(() => {
    const show = () => setOpen(true);
    const hide = () => setOpen(false);
    window.addEventListener("refundit-demo:open-agent", show);
    window.addEventListener("refundit-demo:close-agent", hide);
    return () => {
      window.removeEventListener("refundit-demo:open-agent", show);
      window.removeEventListener("refundit-demo:close-agent", hide);
    };
  }, []);

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
    <div>
      <button
        id="demo-agent"
        type="button"
        onClick={() => last && setOpen(true)}
        disabled={!last}
        aria-label={live ? "Regarder l'agent en direct" : "Revoir le parcours de l'agent"}
        className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors enabled:hover:bg-black/[0.02]"
      >
        <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-[10px] bg-sunken ring-1 ring-black/[0.06]">
          {last?.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy route
            <img src={last.screenshot} alt="" className="size-full object-cover object-top transition duration-500 group-hover:scale-110" />
          ) : (
            <span className="grid size-full place-items-center text-muted"><Bot className="size-5" aria-hidden /></span>
          )}
          {live && <span className="absolute right-1 top-1 size-2 rounded-full bg-danger ring-2 ring-white" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {live ? "L'agent travaille" : "Parcours de l'agent"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={live ? (lastAction ?? "") : "summary"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="block truncate text-[13px] text-muted"
            >
              {error ?? (live ? lastAction : shots.length ? `${shots.length} écrans enregistrés` : "Aucune action enregistrée")}
            </motion.span>
          </AnimatePresence>
        </span>
        {last && (
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted transition group-hover:text-ink">
            {live ? "Direct" : "Voir"}
            <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        )}
      </button>

      {actions && <div className="px-5 pb-4">{actions}</div>}

      {/* Portal: a transformed ancestor (FadeIn) would otherwise trap the fixed overlay inside this card. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>{open && <Lightbox shots={shots} log={log} live={live} onClose={() => setOpen(false)} />}</AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function Lightbox({ shots, log, live, onClose }: { shots: Step[]; log: Step[]; live: boolean; onClose: () => void }) {
  // Jury demo: notes and fun facts sit in a right-hand column, so the agent's screen moves left on large screens.
  const demo = useDemoRaw() !== null;
  // Demo: the jury can't close the agent's screen while it works (the tour closes it at the next step).
  const locked = demo && live;
  const close = useCallback(() => {
    if (!locked) onClose();
  }, [locked, onClose]);
  const [index, setIndex] = useState<number | null>(null); // null = follow latest
  const current = index ?? shots.length - 1;
  const shot = shots[Math.max(0, Math.min(current, shots.length - 1))];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, (i ?? shots.length - 1) - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(shots.length - 1, (i ?? shots.length - 1) + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, shots.length]);

  return (
    <motion.div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#111714]/45 p-3 backdrop-blur-[3px] sm:p-8 ${demo ? "lg:pr-[380px]" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Écran de l'agent"
    >
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-raised shadow-[0_30px_80px_rgba(17,23,20,0.35)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="mono min-w-0 flex-1 truncate rounded-full bg-sunken px-3 py-1.5 text-xs text-muted">{shot?.pageUrl ?? "—"}</span>
          {live && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">EN DIRECT</span>}
          {!locked && (
            <button type="button" onClick={close} aria-label="Fermer" className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-surface shadow-md transition hover:scale-105"><X className="size-4" strokeWidth={2.5} aria-hidden /></button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-sunken">
          {!shot?.screenshot && (
            <div className="grid h-64 place-items-center text-sm text-muted">
              <span className="flex items-center gap-2"><Bot className="size-5 animate-pulse" aria-hidden /> L&apos;agent ouvre son navigateur…</span>
            </div>
          )}
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
