"use client";
// Shared UI. Original illustration: a cheerful little receipt being scanned by a green beam.
// Idle: slow sweep. Scanning: faster sweep, lines "light up" as the beam passes, glow.
import { motion, useReducedMotion } from "motion/react";

const LINES = [
  { y: 92, w: 64, price: true },
  { y: 108, w: 52, price: true },
  { y: 124, w: 70, price: true },
  { y: 140, w: 46, price: true },
];

export function ReceiptScan({ scanning = false, size = 220 }: { scanning?: boolean; size?: number }) {
  const reduce = useReducedMotion();
  const sweep = scanning ? 1.4 : 2.6;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 1.1 }} aria-hidden>
      {/* soft halo */}
      <motion.div
        className="absolute inset-[12%] rounded-full bg-brand/25 blur-3xl"
        animate={reduce ? undefined : { opacity: scanning ? [0.5, 0.9, 0.5] : [0.25, 0.45, 0.25] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.svg
        viewBox="0 0 200 220"
        className="relative size-full"
        animate={reduce ? undefined : { y: [0, -4, 0], rotate: [-2, 1.5, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <clipPath id="paper-clip">
            <path d="M48 18h104v178l-8.7-6-8.6 6-8.7-6-8.7 6-8.6-6-8.7 6-8.7-6-8.6 6-8.7-6-8.7 6-8.6-6-8.7 6z" />
          </clipPath>
          <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4ADE80" stopOpacity="0" />
            <stop offset="0.5" stopColor="#4ADE80" stopOpacity="0.55" />
            <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* paper */}
        <path
          d="M48 18h104v178l-8.7-6-8.6 6-8.7-6-8.7 6-8.6-6-8.7 6-8.7-6-8.6 6-8.7-6-8.7 6-8.6-6-8.7 6z"
          fill="#FFFEFB"
          stroke="#111714"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* face */}
        <circle cx="84" cy="52" r="4.5" fill="#111714" />
        <circle cx="116" cy="52" r="4.5" fill="#111714" />
        <motion.path
          d="M88 64q12 10 24 0"
          fill="none"
          stroke="#111714"
          strokeWidth="3"
          strokeLinecap="round"
          animate={reduce ? undefined : { d: scanning ? ["M88 64q12 10 24 0", "M88 63q12 14 24 0", "M88 64q12 10 24 0"] : "M88 64q12 10 24 0" }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <circle cx="74" cy="62" r="5" fill="#FBCFE8" opacity="0.8" />
        <circle cx="126" cy="62" r="5" fill="#FBCFE8" opacity="0.8" />

        {/* items: lines print one by one, light up green while scanning */}
        <g clipPath="url(#paper-clip)">
          {LINES.map((l, i) => (
            <g key={l.y}>
              <motion.rect
                x="62"
                y={l.y - 4}
                height="7"
                rx="3.5"
                initial={{ width: 0 }}
                animate={{ width: l.w, fill: scanning ? ["#E3E1D8", "#86EFAC", "#E3E1D8"] : "#E3E1D8" }}
                transition={{
                  width: { delay: 0.25 + i * 0.18, duration: 0.5, ease: "easeOut" },
                  fill: { duration: sweep, repeat: Infinity, delay: (i * sweep) / 6, ease: "easeInOut" },
                }}
              />
              <motion.rect
                x="128"
                y={l.y - 4}
                width="12"
                height="7"
                rx="3.5"
                fill="#8A8F88"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 + i * 0.18 }}
              />
            </g>
          ))}
          {/* total */}
          <rect x="62" y="160" width="76" height="2.5" rx="1.25" fill="#111714" opacity="0.8" />
          <motion.rect x="62" y="169" width="34" height="8" rx="4" fill="#111714" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} />
          <motion.rect x="116" y="169" width="24" height="8" rx="4" fill="#22C55E" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} />

          {/* scanning beam */}
          {!reduce && (
            <motion.g animate={{ y: [0, 168, 0] }} transition={{ duration: sweep * 2, repeat: Infinity, ease: "easeInOut" }}>
              <rect x="40" y="6" width="120" height="30" fill="url(#beam)" />
              <rect x="40" y="20" width="120" height="2.5" rx="1.25" fill="#22C55E" />
            </motion.g>
          )}
        </g>
      </motion.svg>

      {/* scanner corners */}
      {["left-[8%] top-[4%] border-l-[3px] border-t-[3px] rounded-tl-[14px]", "right-[8%] top-[4%] border-r-[3px] border-t-[3px] rounded-tr-[14px]", "left-[8%] bottom-[4%] border-b-[3px] border-l-[3px] rounded-bl-[14px]", "right-[8%] bottom-[4%] border-b-[3px] border-r-[3px] rounded-br-[14px]"].map((c) => (
        <motion.span
          key={c}
          className={`absolute size-7 border-ink ${c}`}
          animate={reduce ? undefined : { opacity: scanning ? [1, 0.4, 1] : 0.85 }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      ))}
    </div>
  );
}
