"use client";
// OWNER: Dev 2. Three-step progress (Envoyée → Réponse → Remboursée): dots joined by a line that fills in.
import { motion } from "motion/react";
import { Check } from "lucide-react";

export type ProgressStep = { label: string; on: boolean; date?: string | null };
const ease = [0.22, 1, 0.36, 1] as const;

export function ClaimProgress({ steps, active }: { steps: ProgressStep[]; active: boolean }) {
  const reached = steps.filter((s) => s.on).length; // steps are cumulative
  const fill = steps.length > 1 ? Math.max(0, reached - 1) / (steps.length - 1) : 0;
  return (
    <div className="relative">
      <div className="absolute left-[calc(100%/6)] right-[calc(100%/6)] top-[11px] h-[2px] rounded-full bg-line">
        <motion.div className="h-full origin-left rounded-full bg-ink" initial={{ scaleX: 0 }} animate={{ scaleX: fill }} transition={{ duration: 0.9, ease, delay: 0.2 }} />
      </div>
      <ol className="relative grid grid-cols-3">
        {steps.map((s, i) => {
          const current = active && i === reached; // next step, being worked on
          const last = i === steps.length - 1;
          return (
            <li key={s.label} className="flex flex-col items-center gap-2 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.3, type: "spring", stiffness: 400, damping: 22 }}
                className={`relative grid size-6 place-items-center rounded-full ${
                  s.on ? (last ? "bg-brand text-on-brand" : "bg-ink text-surface") : "border-2 border-line bg-white"
                }`}
              >
                {s.on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                {current && <span className="absolute inset-[-5px] animate-ping rounded-full border border-ink/30" />}
              </motion.span>
              <span className="flex flex-col">
                <span className={`text-[13px] font-semibold ${s.on || current ? "text-ink" : "text-muted"}`}>{s.label}</span>
                <span className="text-xs text-muted">{s.date ?? (current ? "en cours" : " ")}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
