"use client";
// Shared UI. Small animation helpers (Motion) + animated money (NumberFlow) + toaster (Sonner).
import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Toaster as SonnerToaster } from "sonner";

const ease = [0.22, 1, 0.36, 1] as const;

/** Fade + rise on mount. Pass `delay` (s) to stagger siblings. */
export function FadeIn({ children, delay = 0, className, ...rest }: { children: ReactNode; delay?: number; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay }} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Staggered list items. Wrap each <li> content. */
export function StaggerItem({ children, index, className }: { children: ReactNode; index: number; className?: string }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease, delay: Math.min(index, 12) * 0.035 }}
      className={className}
    >
      {children}
    </motion.li>
  );
}

/** Euro amount that rolls to its value (bank-balance feel). */
export function AnimatedMoney({ cents, className = "" }: { cents: number; className?: string }) {
  return (
    <NumberFlow
      value={cents / 100}
      locales="fr-FR"
      format={{ style: "currency", currency: "EUR" }}
      className={`money ${className}`}
      willChange
    />
  );
}

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          fontFamily: "var(--font-jakarta)",
          borderRadius: 14,
          border: "1px solid var(--line)",
          background: "var(--surface-raised)",
          color: "var(--ink)",
        },
      }}
    />
  );
}
