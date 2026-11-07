// OWNER: Dev 2. NotCoca home (fictional demo brand).
import Link from "next/link";
import { DRINKS } from "@/lib/notcoca/catalog";
import { Bubbles, Can, DISPLAY, FLAVORS, Ribbon, motion } from "./brand";

const BAND = ["Original", "Zéro sucres", "Cherry", "Citron", "Fines bulles", "Bien fraîche"];

const PROMISES = [
  { n: "100 %", t: "d'emballages recyclables d'ici 2030" },
  { n: "0 g", t: "de sucres dans NotCoca Zéro" },
  { n: "4", t: "recettes, toutes servies bien fraîches" },
];

export default function NotCocaHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-notcoca text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_72%_35%,rgba(255,255,255,0.3),transparent_55%),radial-gradient(ellipse_at_0%_100%,rgba(0,0,0,0.28),transparent_55%)]"
        />
        <Ribbon className="pointer-events-none absolute inset-x-0 -bottom-20 -z-10 h-[70%] w-full opacity-90" />
        <Bubbles />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-20 pt-12 md:grid-cols-[1.1fr_1fr] md:pb-28 md:pt-20">
          <div className="flex flex-col gap-5">
            <p className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ring-1 ring-white/30 backdrop-blur">
              Nouveau · NotCoca Citron
            </p>
            <h1 className="font-script text-7xl leading-[1.1] drop-shadow-[0_4px_18px_rgba(0,0,0,0.18)] sm:text-8xl">NotCoca</h1>
            <p className={`${DISPLAY} text-4xl font-extrabold leading-[0.95] sm:text-6xl`}>
              Des bulles franches.
              <br />
              Un goût net.
            </p>
            <p className="max-w-md text-white/90">Original, Zéro, Cherry et Citron : toute la gamme NotCoca, à servir bien fraîche.</p>
            <div className="mt-1 flex flex-wrap gap-3">
              <a href="#boissons" className="rounded-full bg-white px-7 py-3.5 font-bold text-notcoca shadow-xl shadow-black/15 transition hover:-translate-y-0.5">
                Nos boissons
              </a>
              <Link href="/notcoca/contact" className="rounded-full border-2 border-white/90 px-7 py-3 font-bold transition hover:bg-white hover:text-notcoca">
                Contactez-nous
              </Link>
            </div>
          </div>

          <div className="relative mx-auto h-[300px] w-[250px] sm:h-[440px] sm:w-[360px]">
            <div aria-hidden className="absolute inset-x-8 bottom-0 h-8 rounded-[50%] bg-black/35 blur-xl" />
            <Can flavor={FLAVORS["NotCoca Zéro"]} className={`${motion.float} absolute bottom-6 left-0 h-[74%] [--tilt:-12deg] [animation-delay:-2s]`} />
            <Can flavor={FLAVORS["NotCoca Original"]} className={`${motion.float} absolute bottom-4 right-0 h-[94%] drop-shadow-2xl [--tilt:7deg]`} />
          </div>
        </div>
      </section>

      {/* Bandeau qui défile */}
      <div className="relative z-10 -mt-10 overflow-hidden py-8">
        <div className="-mx-4 rotate-[-2deg] bg-black py-3 text-white shadow-xl">
          <div className={`${motion.marquee} flex w-max whitespace-nowrap`}>
            {[0, 1].map((k) => (
              <div key={k} aria-hidden={k === 1} className={`${DISPLAY} flex shrink-0 items-center text-2xl font-extrabold sm:text-3xl`}>
                {BAND.map((w) => (
                  <span key={w} className="flex items-center gap-6 pr-6">
                    {w}
                    <span className="text-notcoca">●</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gamme */}
      <section id="boissons" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-notcoca">La gamme</p>
            <h2 className={`${DISPLAY} text-5xl font-extrabold sm:text-6xl`}>Nos boissons</h2>
          </div>
          <p className="max-w-sm text-neutral-600">Quatre recettes, les mêmes fines bulles. En canette, bouteille plastique ou bouteille verre.</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {DRINKS.map((d) => {
            const f = FLAVORS[d];
            return (
              <article key={d} className={`group relative isolate overflow-hidden rounded-[28px] p-4 pb-5 sm:p-6 ${f.card}`}>
                <div aria-hidden className="absolute -right-12 -top-12 -z-10 size-40 rounded-full bg-white/15" />
                <div aria-hidden className="absolute -bottom-16 -left-10 -z-10 size-36 rounded-full bg-black/10" />
                <Can flavor={f} className="mx-auto h-44 drop-shadow-xl transition duration-500 group-hover:-translate-y-2 group-hover:rotate-3 sm:h-56" />
                <h3 className={`${DISPLAY} mt-4 text-2xl font-extrabold leading-none sm:text-3xl`}>{f.label}</h3>
                <p className="mt-1 text-sm opacity-85">{f.tagline}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Engagements */}
      <section id="engagements" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-notcoca">Nos engagements</p>
        <h2 className={`${DISPLAY} text-5xl font-extrabold sm:text-6xl`}>Plus de bulles, moins d&apos;impact</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {PROMISES.map((p) => (
            <div key={p.n} className="rounded-[28px] bg-neutral-100 p-6">
              <p className={`${DISPLAY} text-6xl font-extrabold normal-case text-notcoca`}>{p.n}</p>
              <p className="mt-1 font-semibold">{p.t}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">Engagements d&apos;une marque fictive, pour la démonstration.</p>
      </section>

      {/* Service consommateurs */}
      <section id="entreprise" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20">
        <div className="relative isolate overflow-hidden rounded-[32px] bg-notcoca px-6 py-12 text-white sm:px-12 sm:py-14">
          <Ribbon className="absolute inset-x-0 -bottom-10 -z-10 h-2/3 w-full opacity-25" />
          <Bubbles count={5} />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className={`${DISPLAY} text-4xl font-extrabold leading-none sm:text-5xl`}>Une question, un problème ?</h2>
              <p className="mt-3 max-w-md text-white/90">Notre service consommateurs vous répond du lundi au vendredi.</p>
            </div>
            <Link href="/notcoca/contact" className="w-fit shrink-0 rounded-full bg-white px-7 py-3.5 font-bold text-notcoca shadow-xl shadow-black/15 transition hover:-translate-y-0.5">
              Contactez-nous →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
