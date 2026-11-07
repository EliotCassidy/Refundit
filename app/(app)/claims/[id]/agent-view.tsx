"use client";
// OWNER: Dev 2. Built-in Agent View: live screenshot + action log while the agent runs (with the
// Stop button right there), step-by-step replay afterwards. Polls /api/claims/:id/agent every 3 s.
import { useEffect, useState, type ReactNode } from "react";

type Step = { at: string; kind: string; text: string | null; screenshot: string | null; pageUrl: string | null };

export function AgentView({ claimId, live, actions }: { claimId: string; live: boolean; actions?: ReactNode }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState<number | null>(null); // null = follow the latest screenshot
  const [error, setError] = useState<string | null>(null);

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
  const actionsLog = steps.filter((s) => s.kind === "action" || s.kind === "error");
  const current = index ?? shots.length - 1;
  const shot = shots.length ? shots[Math.max(0, Math.min(current, shots.length - 1))] : null;

  return (
    <section className={`flex flex-col gap-3 rounded-[20px] p-4 md:p-5 ${live ? "panel panel-claim" : "border border-line bg-raised"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{live ? "L'agent remplit le formulaire" : "Replay de l'agent"}</h2>
          <p className={`text-sm ${live ? "text-[#5B635E]" : "text-muted"}`}>
            {live ? "Tu peux le regarder… et l'arrêter à tout moment." : `${shots.length} écrans · ${actionsLog.length} actions`}
          </p>
        </div>
        {live && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#C81E1E] px-2.5 py-1 text-[11px] font-bold text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> EN DIRECT
          </span>
        )}
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_10px_30px_rgba(17,23,20,0.12)]">
        <div className="flex items-center gap-2 border-b border-black/10 bg-[#EFEDE5] px-3 py-2">
          <span className="flex gap-1" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#E3E1D8]" /><span className="size-2.5 rounded-full bg-[#E3E1D8]" /><span className="size-2.5 rounded-full bg-[#E3E1D8]" />
          </span>
          <span className="mono min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-[11px] font-normal text-[#5B635E]">
            {shot?.pageUrl ?? (live ? "ouverture du navigateur…" : "—")}
          </span>
        </div>
        {shot?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy route, not optimizable
          <img src={shot.screenshot} alt="Écran du navigateur de l'agent" className="aspect-square w-full bg-white object-contain object-top" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-sm text-[#5B635E]">
            {error ?? (live ? "L'agent démarre son navigateur…" : "Pas d'écran enregistré")}
          </div>
        )}
      </div>

      {!live && shots.length > 1 && (
        <div className="flex items-center gap-2">
          <button onClick={() => setIndex(Math.max(0, current - 1))} className="grid size-9 place-items-center rounded-full border border-line-strong/50" aria-label="Écran précédent">←</button>
          <input type="range" min={0} max={shots.length - 1} value={current} onChange={(e) => setIndex(Number(e.target.value))} className="flex-1 accent-[var(--ink)]" aria-label="Parcourir le replay" />
          <button onClick={() => setIndex(Math.min(shots.length - 1, current + 1))} className="grid size-9 place-items-center rounded-full border border-line-strong/50" aria-label="Écran suivant">→</button>
          <span className="mono w-12 text-right text-xs text-muted">{current + 1}/{shots.length}</span>
        </div>
      )}

      {actionsLog.length > 0 && (
        <ol className={`flex max-h-40 flex-col-reverse gap-1 overflow-y-auto rounded-[14px] p-3 text-xs ${live ? "bg-white/70 text-[#111714]" : "bg-sunken"}`}>
          {[...actionsLog].reverse().slice(0, 40).map((a, i) => (
            <li key={i} className={`flex gap-2 ${a.kind === "error" ? "text-[#92400E]" : ""}`}>
              <span aria-hidden>{a.kind === "error" ? "↻" : "›"}</span>
              <span className="min-w-0 truncate">{a.text}</span>
            </li>
          ))}
        </ol>
      )}

      {actions}
    </section>
  );
}
