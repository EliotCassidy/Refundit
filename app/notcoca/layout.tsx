// OWNER: Dev 2. NotCoca — FICTIONAL demo brand site (public, no Refundit auth).
// Page structure mirrors a typical soda brand site (header/nav, hero, footer columns);
// visual identity is NotCoca's own: no third-party logo, typeface or imagery.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "NotCoca France", template: "%s | NotCoca France" },
  description: "NotCoca — marque de démonstration fictive (projet hackathon Refundit).",
  robots: { index: false, follow: false },
};

export function NotCocaLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#1F3BFF" />
        <circle cx="11" cy="19" r="3" fill="#fff" />
        <circle cx="18.5" cy="12" r="4.2" fill="#fff" />
        <circle cx="21.5" cy="21" r="2" fill="#fff" />
      </svg>
      <span className="text-xl font-black tracking-tight">
        Not<span className="text-[#1F3BFF]">Coca</span>
      </span>
    </span>
  );
}

const NAV = [
  { href: "/notcoca", label: "Nos boissons" },
  { href: "/notcoca#engagements", label: "Nos engagements" },
  { href: "/notcoca#entreprise", label: "Notre entreprise" },
  { href: "/notcoca/contact", label: "Contactez-nous" },
];

export default function NotCocaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-neutral-900 [color-scheme:light]">
      <div className="bg-neutral-900 py-1.5 text-center text-xs text-white">
        Site de démonstration — NotCoca est une marque fictive
      </div>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/notcoca" aria-label="NotCoca, accueil">
            <NotCocaLogo />
          </Link>
          <nav className="hidden gap-6 text-sm font-semibold md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-[#1F3BFF]">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/notcoca/contact" className="rounded-full bg-[#1F3BFF] px-4 py-2 text-sm font-semibold text-white md:hidden">
            Contact
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-neutral-900 text-neutral-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-white">Nos boissons</span>
            <span>NotCoca Original</span>
            <span>NotCoca Zéro</span>
            <span>NotCoca Cherry</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-white">Notre entreprise</span>
            <span>Qui sommes-nous</span>
            <span>Engagements</span>
            <span>Presse</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-white">Aide</span>
            <Link href="/notcoca/contact" className="hover:text-white">Service consommateurs</Link>
            <span>Mentions légales</span>
            <span>Politique de confidentialité</span>
          </div>
        </div>
        <p className="border-t border-neutral-800 px-4 py-4 text-center text-xs text-neutral-500">
          © 2026 NotCoca — marque fictive créée pour une démonstration. Aucun lien avec une marque existante.
        </p>
      </footer>
    </div>
  );
}
