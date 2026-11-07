// OWNER: Dev 2. NotCoca home (fictional demo brand).
import Link from "next/link";
import { DRINKS } from "@/lib/notcoca/catalog";

const COLORS = ["#1F3BFF", "#111827", "#B0144F", "#C9A400"];

export default function NotCocaHome() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#1F3BFF] to-[#0B1A8C] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Nouveau</p>
          <h1 className="max-w-xl text-4xl font-black leading-tight sm:text-5xl">Les bulles qui ne ressemblent à aucune autre.</h1>
          <p className="max-w-lg text-white/80">Découvrez la gamme NotCoca : Original, Zéro, Cherry et Citron.</p>
          <div className="flex gap-3">
            <a href="#boissons" className="rounded-full bg-white px-5 py-2.5 font-semibold text-[#1F3BFF]">Nos boissons</a>
            <Link href="/notcoca/contact" className="rounded-full border border-white/60 px-5 py-2.5 font-semibold">
              Contactez-nous
            </Link>
          </div>
        </div>
      </section>

      <section id="boissons" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold">Nos boissons</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {DRINKS.map((d, i) => (
            <div key={d} className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-50 p-6">
              <svg viewBox="0 0 40 90" className="h-28" aria-hidden>
                <rect x="6" y="10" width="28" height="76" rx="8" fill={COLORS[i]} />
                <rect x="12" y="2" width="16" height="10" rx="3" fill="#9CA3AF" />
                <rect x="6" y="38" width="28" height="18" fill="#fff" opacity="0.9" />
              </svg>
              <span className="text-center font-semibold">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="engagements" className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h3 className="text-lg font-bold">Nos engagements</h3>
          <p className="mt-2 text-sm text-neutral-600">Des emballages 100 % recyclables d&apos;ici 2030 (marque fictive).</p>
        </div>
        <div id="entreprise" className="rounded-2xl border border-neutral-200 p-6">
          <h3 className="text-lg font-bold">Une question, un problème ?</h3>
          <p className="mt-2 text-sm text-neutral-600">Notre service consommateurs vous répond du lundi au vendredi.</p>
          <Link href="/notcoca/contact" className="mt-3 inline-block font-semibold text-[#1F3BFF]">Contactez-nous →</Link>
        </div>
      </section>
    </>
  );
}
