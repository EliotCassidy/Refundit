// OWNER: Dev 2. NotCoca — FICTIONAL demo brand site (public, no Refundit auth).
// Page structure mirrors a typical soda brand site (header/nav, hero, footer columns);
// visual identity: dynamic red and white, flowing ribbon, script wordmark, condensed capitals.
import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import { DISPLAY, NotCocaLogo, Wave } from "./brand";

export const metadata: Metadata = {
  title: { default: "NotCoca France", template: "%s | NotCoca France" },
  description: "NotCoca — marque de démonstration fictive (projet hackathon Refundit).",
  robots: { index: false, follow: false },
};

const display = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-nc-display" });

const NAV = [
  { href: "/notcoca#boissons", label: "Nos boissons" },
  { href: "/notcoca#engagements", label: "Nos engagements" },
  { href: "/notcoca#entreprise", label: "Notre entreprise" },
];

const FOOTER = [
  { title: "Nos boissons", items: ["NotCoca Original", "NotCoca Zéro", "NotCoca Cherry", "NotCoca Citron"] },
  { title: "Notre entreprise", items: ["Qui sommes-nous", "Engagements", "Presse"] },
  { title: "Informations", items: ["Mentions légales", "Politique de confidentialité", "Cookies"] },
];

export default function NotCocaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} flex min-h-full flex-1 flex-col bg-white text-neutral-900 [color-scheme:light]`}>
      <div className="bg-black py-1.5 text-center text-[11px] font-medium tracking-wide text-white/85">
        Site de démonstration — NotCoca est une marque fictive
      </div>

      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/notcoca" aria-label="NotCoca, accueil">
            <NotCocaLogo />
          </Link>
          <nav className={`${DISPLAY} hidden items-center gap-1 text-[15px] font-bold md:flex`}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 transition-colors hover:bg-notcoca/10 hover:text-notcoca">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/notcoca/contact"
            className="rounded-full bg-notcoca px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-notcoca/25 transition hover:-translate-y-0.5 hover:bg-notcoca-dark"
          >
            Contactez-nous
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="relative mt-24 bg-notcoca text-white">
        <Wave className="absolute inset-x-0 -top-[47px] h-12 w-full text-notcoca" />
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 pb-10 pt-10 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
            <NotCocaLogo light />
            <p className="text-sm text-white/85">Des bulles franches, un goût net.</p>
            <Link href="/notcoca/contact" className="w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-notcoca transition hover:-translate-y-0.5">
              Service consommateurs
            </Link>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title} className="flex flex-col gap-2 text-sm">
              <span className={`${DISPLAY} mb-1 text-lg font-bold`}>{col.title}</span>
              {col.items.map((i) => (
                <span key={i} className="text-white/85">{i}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-white/20">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/80">
            © 2026 NotCoca — marque fictive créée pour une démonstration. Aucun lien avec une marque existante.
          </p>
        </div>
      </footer>
    </div>
  );
}
