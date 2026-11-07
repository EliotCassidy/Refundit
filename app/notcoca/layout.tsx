// OWNER: Dev 2. NotCoca — FICTIONAL demo brand site (public, no Refundit auth).
// Page structure mirrors a typical soda brand site (header/nav, hero, footer columns);
// visual identity follows the brand direction: dynamic red, white, flowing script logo.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "NotCoca France", template: "%s | NotCoca France" },
  description: "NotCoca — marque de démonstration fictive (projet hackathon Refundit).",
  robots: { index: false, follow: false },
};

export function NotCocaLogo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <path
          fill={light ? "#fff" : "var(--notcoca-red)"}
          d="M16 4c-2.2 4.4-6 6.4-6 11.2C10 20.5 12.7 24 16 24s6-3.5 6-8.8C22 10.4 18.2 8.4 16 4z"
        />
        <circle cx="11.2" cy="24.6" r="2.6" fill={light ? "#fff" : "var(--notcoca-red)"} />
        <circle cx="18.6" cy="23" r="3.6" fill={light ? "#fff" : "var(--notcoca-red)"} />
        <circle cx="22" cy="25.4" r="1.7" fill={light ? "#fff" : "var(--notcoca-red)"} />
      </svg>
      <span className={`font-script text-2xl leading-none ${light ? "text-white" : "text-notcoca"}`}>NotCoca</span>
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
              <Link key={n.href} href={n.href} className="transition-colors hover:text-notcoca">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/notcoca/contact"
            className="rounded-full bg-notcoca px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-notcoca-dark md:hidden"
          >
            Contact
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-notcoca text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <NotCocaLogo className="mb-1 scale-90 origin-left" light />
            <span className="font-semibold">NotCoca France</span>
            <Link href="/notcoca/contact" className="underline-offset-2 hover:underline">Service consommateurs</Link>
            <span>Mentions légales</span>
            <span>Politique de confidentialité</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Nos boissons</span>
            <span>NotCoca Original</span>
            <span>NotCoca Zéro</span>
            <span>NotCoca Cherry</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Notre entreprise</span>
            <span>Qui sommes-nous</span>
            <span>Engagements</span>
            <span>Presse</span>
          </div>
        </div>
        <p className="px-4 pb-5 text-center text-xs text-white/80">
          © 2026 NotCoca — marque fictive créée pour une démonstration. Aucun lien avec une marque existante.
        </p>
      </footer>
    </div>
  );
}
