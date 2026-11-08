// Shared UI (design system). Logo, money, Stripe badge, candy icons.
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

/** "Refund✓it" wordmark (public/logo-refundit.svg, viewBox cropped to the drawing). `className` sets the height. */
export function Logo({ className = "h-5" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG wordmark, no optimizer needed
    <img src="/logo-refundit.svg" alt="Refundit" width={111} height={20} className={`block w-auto ${className}`} />
  );
}

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatEuros = (cents: number) => fmt.format(cents / 100);

/** Display amount (tabular sans). Use mono={true} for ticket-like amounts in lists. */
export function Money({ cents, className = "", mono = false }: { cents: number; className?: string; mono?: boolean }) {
  return <span className={`${mono ? "mono font-medium" : "money"} ${className}`}>{formatEuros(cents)}</span>;
}

/** "Paiements sécurisés par Stripe" — the name only (no third-party logo artwork). */
export function StripeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <Lock className="size-3.5" strokeWidth={2} aria-hidden />
      Paiements sécurisés par <span className="font-semibold text-[#635BFF]">Stripe</span>
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
  recover: <span className="text-[50%] font-bold leading-none">€</span>,
};

export function Candy({ kind, size = 44 }: { kind: CandyKind; size?: number }) {
  return (
    <span className={`candy candy-${kind} shrink-0`} style={{ width: size, height: size, fontSize: size }} aria-hidden>
      {CANDY_GLYPH[kind]}
    </span>
  );
}

/** Standard white card: 1px line border, flat fill, 20px radius. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-line bg-raised ${className}`}>{children}</div>;
}
