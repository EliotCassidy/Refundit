// OWNER: Dev 2. NotCoca home (fictional demo brand).
import Link from "next/link";
import { DRINKS } from "@/lib/notcoca/catalog";

const CANS: Record<string, { body: string; cap: string; label: string; text: "light" | "dark" }> = {
  "NotCoca Original": { body: "var(--notcoca-red)", cap: "#1a1a1a", label: "transparent", text: "light" },
  "NotCoca Zéro": { body: "#20242b", cap: "var(--notcoca-red)", label: "transparent", text: "light" },
  "NotCoca Cherry": { body: "#8e1331", cap: "var(--notcoca-red)", label: "transparent", text: "light" },
  "NotCoca Citron": { body: "#f0b429", cap: "var(--notcoca-red)", label: "transparent", text: "dark" },
};

export default function NotCocaHome() {
  return (
    <>
      <section className="relative overflow-hidden bg-notcoca text-white">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-16 sm:py-24">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/80">Nouveau</p>
          <h1 className="max-w-2xl font-script text-5xl leading-tight sm:text-7xl">NotCoca</h1>
          <p className="max-w-lg text-lg font-bold">Open happiness. Les bulles qui ne ressemblent à aucune autre.</p>
          <p className="max-w-lg text-white/85">Découvrez la gamme NotCoca : Original, Zéro, Cherry et Citron.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href="#boissons" className="rounded-full bg-white px-6 py-3 font-bold text-notcoca transition-colors hover:bg-white/90">
              Nos boissons
            </a>
            <Link href="/notcoca/contact" className="rounded-full border-2 border-white px-6 py-3 font-bold transition-colors hover:bg-white hover:text-notcoca">
              Contactez-nous
            </Link>
          </div>
        </div>
      </section>

      <section id="boissons" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-script text-4xl text-notcoca">Nos boissons</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {DRINKS.map((d) => {
            const c = CANS[d];
            return (
              <div key={d} className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <svg viewBox="0 0 40 90" className="h-28" aria-hidden>
                  <rect x="6" y="10" width="28" height="76" rx="9" fill={c.body} />
                  <rect x="12" y="2" width="16" height="10" rx="3" fill={c.cap} />
                  <rect x="6" y="36" width="28" height="22" fill={c.text === "light" ? "rgba(255,255,255,0.92)" : "var(--notcoca)"} />
                  <text
                    x="20"
                    y="51"
                    textAnchor="middle"
                    fontFamily="Pacifico, 'Segoe Script', 'Brush Script MT', cursive"
                    fontSize="9"
                    fill={c.text === "light" ? (c.body === "#f0b429" ? "#fff" : "var(--notcoca-red)") : "#fff"}
                  >
                    {d.replace("NotCoca ", "")}
                  </text>
                  <rect x="10" y="16" width="4" height="60" rx="2" fill="rgba(255,255,255,0.25)" />
                </svg>
                <span className="text-center font-bold">{d}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="engagements" className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-script text-2xl text-notcoca">Nos engagements</h3>
          <p className="mt-2 text-sm text-neutral-600">Des emballages 100 % recyclables d&apos;ici 2030 (marque fictive).</p>
        </div>
        <div id="entreprise" className="rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-script text-2xl text-notcoca">Une question, un problème ?</h3>
          <p className="mt-2 text-sm text-neutral-600">Notre service consommateurs vous répond du lundi au vendredi.</p>
          <Link href="/notcoca/contact" className="mt-3 inline-block font-bold text-notcoca">Contactez-nous →</Link>
        </div>
      </section>
    </>
  );
}
