"use client";
// Shared UI. Soft animated color field behind glass cards (blurred blobs drifting slowly).
// Fixed, non-interactive, respects reduced motion.
import { motion, useReducedMotion } from "motion/react";

const BLOBS = [
  { color: "rgba(134, 239, 172, 0.55)", size: 520, x: ["-10%", "6%", "-10%"], y: ["-8%", "4%", "-8%"], pos: "left-[-10%] top-[-10%]", d: 18 },
  { color: "rgba(253, 186, 116, 0.45)", size: 560, x: ["8%", "-6%", "8%"], y: ["0%", "8%", "0%"], pos: "right-[-15%] top-[10%]", d: 22 },
  { color: "rgba(253, 230, 138, 0.5)", size: 480, x: ["0%", "10%", "0%"], y: ["6%", "-6%", "6%"], pos: "left-[10%] bottom-[-20%]", d: 20 },
  { color: "rgba(147, 197, 253, 0.35)", size: 420, x: ["-6%", "4%", "-6%"], y: ["-4%", "6%", "-4%"], pos: "right-[5%] bottom-[-10%]", d: 24 },
];

export function Aurora() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[90px] ${b.pos}`}
          style={{ width: b.size, height: b.size, background: b.color }}
          animate={reduce ? undefined : { x: b.x, y: b.y, scale: [1, 1.08, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Frosted glass panel (Apple-like): translucent white, strong blur, hairline highlight. */
export const glass =
  "rounded-[28px] border border-white/70 bg-white/55 shadow-[0_24px_60px_-12px_rgba(17,23,20,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-black/[0.03] backdrop-blur-2xl backdrop-saturate-150";
