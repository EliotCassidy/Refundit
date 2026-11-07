"use client";
// OWNER: Dev 2. Billing page visuals: usage ring (Motion), FAQ accordion (Radix) styled as list rows.
import * as Accordion from "@radix-ui/react-accordion";
import { motion } from "motion/react";
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

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion.Root type="single" collapsible>
      {items.map((it, k) => (
        <Accordion.Item key={it.q} value={`q${k}`} className={k ? "border-t border-black/[0.05]" : ""}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 min-h-[56px] px-5 py-3 text-left text-[15px] font-medium outline-none transition-colors hover:bg-black/[0.02]">
              {it.q}
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]:rotate-180" aria-hidden />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-sm text-muted data-[state=closed]:animate-[acc-up_220ms_ease-out] data-[state=open]:animate-[acc-down_220ms_ease-out]">
            <p className="px-5 pb-4 leading-relaxed">{it.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
