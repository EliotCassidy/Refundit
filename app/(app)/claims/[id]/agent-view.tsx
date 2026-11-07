"use client";
// OWNER: Dev 2. Built-in Agent View: live screenshot + action log while the agent runs,
// step-by-step replay afterwards. Polls /api/claims/:id/agent every 3 s while submitting.
import { useEffect, useState } from "react";

type Step = { at: string; kind: string; text: string | null; screenshot: string | null; pageUrl: string | null };

export function AgentView({ claimId, live }: { claimId: string; live: boolean }) {
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
  const actions = steps.filter((s) => s.kind === "action" || s.kind === "error");
  if (!shots.length && !actions.length) {
    return error ? <p className="text-sm text-neutral-500">{error}</p> : live ? <p className="text-sm text-neutral-500">L&apos;agent démarre…</p> : null;
  }
  const current = index ?? shots.length - 1;
  const shot = shots[Math.max(0, Math.min(current, shots.length - 1))];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{live ? "L'agent travaille" : "Replay de l'agent"}</h2>
        {live && <span className="flex items-center gap-1 text-xs text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />EN DIRECT</span>}
      </div>
      {shot?.screenshot && (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy route, not optimizable
        <img src={shot.screenshot} alt="Écran du navigateur de l'agent" className="w-full rounded-xl border border-neutral-200" />
      )}
      {shot?.pageUrl && <p className="truncate text-xs text-neutral-500">{shot.pageUrl}</p>}
      {!live && shots.length > 1 && (
        <div className="flex items-center gap-2">
          <button onClick={() => setIndex(Math.max(0, current - 1))} className="rounded-lg border px-3 py-1 text-sm">←</button>
          <input type="range" min={0} max={shots.length - 1} value={current} onChange={(e) => setIndex(Number(e.target.value))} className="flex-1" />
          <button onClick={() => setIndex(Math.min(shots.length - 1, current + 1))} className="rounded-lg border px-3 py-1 text-sm">→</button>
          <span className="w-14 text-right text-xs text-neutral-500">{current + 1}/{shots.length}</span>
        </div>
      )}
      <ol className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl bg-neutral-50 p-3 text-xs">
        {actions.slice(-40).map((a, i) => (
          <li key={i} className={a.kind === "error" ? "text-amber-700" : "text-neutral-700"}>{a.text}</li>
        ))}
      </ol>
    </section>
  );
}
