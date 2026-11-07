// Shared UI (design system). Logo, money, Stripe badge, candy icons.
import type { ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight text-ink ${className}`}>
      <span className="grid size-7 place-items-center rounded-full bg-brand text-on-brand" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="text-lg">Refundit</span>
    </span>
  );
}

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatEuros = (cents: number) => fmt.format(cents / 100);

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`money ${className}`}>{formatEuros(cents)}</span>;
}

/** "Paiements sécurisés par Stripe" — the name only (no third-party logo artwork). */
export function StripeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ${className}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      Paiements sécurisés par <span className="font-bold tracking-tight text-[#8f8aff]">Stripe</span>
    </span>
  );
}

type CandyKind = "scan" | "check" | "claim" | "recover";
const CANDY_GLYPH: Record<CandyKind, ReactNode> = {
  scan: (
    <svg viewBox="0 0 24 24" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z" /><path d="M10 8h4M10 12h4" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  claim: <span className="text-[60%] leading-none">!</span>,
  recover: <span className="money text-[50%] leading-none">€</span>,
};

export function Candy({ kind, size = 44 }: { kind: CandyKind; size?: number }) {
  return (
    <span className={`candy candy-${kind} shrink-0`} style={{ width: size, height: size, fontSize: size }} aria-hidden>
      {CANDY_GLYPH[kind]}
    </span>
  );
}
