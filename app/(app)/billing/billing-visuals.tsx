"use client";
// OWNER: Dev 2. Billing page visuals: usage ring (Motion), animated gradient border (Motion),
// FAQ accordion (Radix), animated price (NumberFlow).
import type { ReactNode } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

export function UsageRing({ used, limit, unlimited }: { used: number; limit: number; unlimited: boolean }) {
  const ratio = unlimited ? 1 : Math.min(used / Math.max(limit, 1), 1);
  const full = !unlimited && used >= limit;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[88px] shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(17,23,20,0.07)" strokeWidth="7" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={unlimited ? "#22C55E" : full ? "#F59E0B" : "#111714"}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>
      <span className="text-center leading-none">
        {unlimited ? (
          <span className="text-2xl font-bold">∞</span>
        ) : (
          <>
            <span className="money text-xl">{Math.min(used, limit)}</span>
            <span className="text-sm text-muted">/{limit}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** Card with a slowly rotating gradient border (highlighted plan). */
export function GlowBorder({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-[26px] p-[1.5px] shadow-[0_24px_60px_-16px_rgba(21,128,61,0.35)]">
      {active && (
        <motion.div
          className="absolute inset-[-60%] bg-[conic-gradient(from_0deg,#22C55E,#BBF7D0,#FDE68A,#86EFAC,#22C55E)]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
      )}
      <div className="relative h-full rounded-[24.5px] bg-white/90 backdrop-blur-xl">{children}</div>
    </div>
  );
}

export function Price({ cents }: { cents: number }) {
  return <NumberFlow value={cents / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} className="money text-[40px] leading-none" />;
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion.Root type="single" collapsible className="overflow-hidden rounded-[20px] border border-white/70 bg-white/60 backdrop-blur-xl">
      {items.map((it, k) => (
        <Accordion.Item key={it.q} value={`q${k}`} className={k ? "border-t border-black/[0.05]" : ""}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[15px] font-medium outline-none transition hover:bg-white/50">
              {it.q}
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]:rotate-180" aria-hidden />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-sm text-muted data-[state=closed]:animate-[acc-up_220ms_ease-out] data-[state=open]:animate-[acc-down_220ms_ease-out]">
            <p className="px-5 pb-4">{it.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
