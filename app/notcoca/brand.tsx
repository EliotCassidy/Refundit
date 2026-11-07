// OWNER: Dev 2. NotCoca — FICTIONAL demo brand: logo, can illustration, wave, ribbon, bubbles.
// Our own drawings (no real brand asset): dynamic red and white, script wordmark, flowing ribbon.
import type { CSSProperties } from "react";
import styles from "./notcoca.module.css";

/** Titres : capitales condensées (police chargée dans layout.tsx). */
export const DISPLAY = "[font-family:var(--font-nc-display)] uppercase tracking-tight";

export function NotCocaLogo({ className = "", light = false }: { className?: string; light?: boolean }) {
  const fill = light ? "#fff" : "var(--notcoca-red)";
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <path style={{ fill }} d="M16 3c-2.4 4.6-6.4 6.8-6.4 11.8 0 5.4 2.9 9 6.4 9s6.4-3.6 6.4-9C22.4 9.8 18.4 7.6 16 3z" />
        <circle cx="10.6" cy="25.2" r="2.5" style={{ fill }} />
        <circle cx="18.4" cy="24" r="3.4" style={{ fill }} />
        <circle cx="22.4" cy="26.6" r="1.6" style={{ fill }} />
      </svg>
      <span className={`font-script text-[26px] leading-none ${light ? "text-white" : "text-notcoca"}`}>NotCoca</span>
    </span>
  );
}

export type Flavor = {
  id: string;
  label: string;
  tagline: string;
  body: string; // couleur de la canette
  edge: string; // bords (effet cylindre)
  ribbon: string; // vague sur la canette
  mark: string; // logo sur la canette
  ink: string; // petits textes sur la canette
  card: string; // fond de la carte produit (classes Tailwind)
};

export const FLAVORS: Record<string, Flavor> = {
  "NotCoca Original": {
    id: "original", label: "Original", tagline: "Le goût franc des fines bulles",
    body: "#f40009", edge: "#a00006", ribbon: "#ffffff", mark: "#ffffff", ink: "#ffffff", card: "bg-notcoca text-white",
  },
  "NotCoca Zéro": {
    id: "zero", label: "Zéro sucres", tagline: "Zéro sucres, tout le pétillant",
    body: "#1f1f22", edge: "#000000", ribbon: "#f40009", mark: "#ffffff", ink: "#ffffff", card: "bg-neutral-900 text-white",
  },
  "NotCoca Cherry": {
    id: "cherry", label: "Cherry", tagline: "Une pointe de cerise",
    body: "#a3123c", edge: "#5c0820", ribbon: "#ffffff", mark: "#ffffff", ink: "#ffffff", card: "bg-[#a3123c] text-white",
  },
  "NotCoca Citron": {
    id: "citron", label: "Citron", tagline: "Un zeste de citron jaune",
    body: "#ffd23f", edge: "#c99700", ribbon: "#f40009", mark: "#f40009", ink: "#1f1f22", card: "bg-[#ffd23f] text-neutral-900",
  },
};

const DROPS: [number, number, number][] = [
  [30, 60, 1.6], [84, 74, 2.2], [52, 196, 1.8], [92, 180, 1.4], [24, 132, 1.2], [70, 46, 1.1], [40, 176, 2.4], [96, 108, 1.5],
];

/** Canette dessinée (SVG) : corps en dégradé pour l'effet cylindre, vague, logo script, gouttes de condensation. */
export function Can({ flavor: f, className = "", style }: { flavor: Flavor; className?: string; style?: CSSProperties }) {
  const id = `nc-can-${f.id}`;
  return (
    <svg viewBox="0 0 120 232" className={className} style={style} role="img" aria-label={`Canette NotCoca ${f.label}`}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1">
          <stop offset="0" stopColor={f.edge} />
          <stop offset="0.2" stopColor={f.body} />
          <stop offset="0.8" stopColor={f.body} />
          <stop offset="1" stopColor={f.edge} />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" x2="1">
          <stop offset="0" stopColor="#80858c" />
          <stop offset="0.35" stopColor="#f5f6f8" />
          <stop offset="0.65" stopColor="#c6cad0" />
          <stop offset="1" stopColor="#787d85" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="14" y="24" width="92" height="186" rx="12" />
        </clipPath>
      </defs>
      <path d="M24 26 L28 12 Q60 4 92 12 L96 26 Z" fill={`url(#${id}-metal)`} />
      <ellipse cx="60" cy="12" rx="32" ry="5" fill="#e4e6e9" />
      <ellipse cx="60" cy="11.5" rx="11" ry="2.4" fill="#b4b8be" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="14" y="24" width="92" height="186" fill={`url(#${id}-body)`} />
        <path d="M14 150 C 40 116, 72 178, 106 126 L106 146 C 72 196, 40 136, 14 170 Z" fill={f.ribbon} />
        <path d="M14 180 C 44 152, 76 198, 106 160 L106 167 C 76 205, 44 159, 14 187 Z" fill={f.ribbon} opacity="0.5" />
        <rect x="26" y="24" width="9" height="186" fill="#fff" opacity="0.22" />
        <rect x="40" y="24" width="3" height="186" fill="#fff" opacity="0.14" />
        {DROPS.map(([cx, cy, r], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 1.35} fill="#fff" opacity="0.38" />
        ))}
      </g>
      <path d="M16 208 H104 L98 222 Q60 231 22 222 Z" fill={`url(#${id}-metal)`} />
      <text x="60" y="92" textAnchor="middle" fontSize="25" fill={f.mark} transform="rotate(-9 60 92)" style={{ fontFamily: "var(--font-pacifico), cursive" }}>
        NotCoca
      </text>
      <text x="60" y="117" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="2.5" fill={f.ink} style={{ fontFamily: "var(--font-nc-display), sans-serif" }}>
        {f.label.toUpperCase()}
      </text>
      <text x="60" y="201" textAnchor="middle" fontSize="7" letterSpacing="1.5" fill={f.ink} opacity="0.85" style={{ fontFamily: "var(--font-nc-display), sans-serif" }}>
        33 CL
      </text>
    </svg>
  );
}

/** Bord ondulé entre deux sections (couleur = currentColor). */
export function Wave({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className={className} aria-hidden>
      <path fill="currentColor" d="M0 70 C 240 10 430 120 720 74 C 1000 30 1210 100 1440 44 V120 H0 Z" />
    </svg>
  );
}

/** Le ruban blanc qui traverse les fonds rouges. */
export function Ribbon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="none" fill="none" className={className} aria-hidden>
      <path d="M-60 310 C 300 120 640 390 980 200 C 1190 86 1330 126 1500 56" stroke="#fff" strokeWidth="28" strokeLinecap="round" />
      <path d="M-60 352 C 300 172 660 420 1000 244 C 1200 140 1340 172 1500 112" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

// [gauche %, taille px, durée s, retard s, dérive px]
const BUBBLES: [number, number, number, number, number][] = [
  [6, 14, 9, -2, 20], [14, 8, 7, -5, -10], [23, 20, 11, -1, 30], [35, 10, 8, -6, -20], [47, 16, 10, -3, 15],
  [58, 7, 6.5, -4, -12], [66, 22, 12, -7, 25], [74, 11, 8.5, -1.5, -18], [83, 15, 9.5, -8, 12], [92, 9, 7.5, -3.5, -8],
];

export function Bubbles({ count = BUBBLES.length }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {BUBBLES.slice(0, count).map(([left, size, duration, delay, drift], i) => (
        <span
          key={i}
          className={styles.bubble}
          style={{ left: `${left}%`, width: size, height: size, animationDuration: `${duration}s`, animationDelay: `${delay}s`, "--drift": `${drift}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}

export const motion = styles;
