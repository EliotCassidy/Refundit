"use client";
// OWNER: Dev 2. Jury demo tour (driver.js spotlight: everything around the focused element is dimmed).
// Mounted on every app page and on the NotCoca back-office; it reads the step from localStorage (demo-state)
// and the page state from data-demo-* attributes, so it follows the jury from page to page:
// dashboard (balance → purchases → Scanner) → demo receipt → NotCoca claim → live agent → missing info →
// NotCoca back-office (refund) → back on the dashboard (email + balance) → end.
import "driver.js/dist/driver.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { driver, type Config, type DriveStep, type Driver } from "driver.js";
import { Hand, Lightbulb, PartyPopper, RotateCcw, Sparkles, X } from "lucide-react";
import { getDemo, patchDemo, setDemo, useDemoRaw, type DemoState } from "./demo-state";

const BASE: Config = {
  animate: true,
  overlayColor: "#0b0f0d",
  overlayOpacity: 0.62,
  stagePadding: 10,
  stageRadius: 26,
  allowClose: false,
  overlayClickBehavior: "none",
  allowKeyboardControl: false,
  smoothScroll: true,
  popoverClass: "refundit-tour",
  showProgress: false,
  nextBtnText: "Suivant",
  prevBtnText: "Retour",
  doneBtnText: "Compris",
};

/** Polls the DOM (the server re-renders pages: status attributes change under us). */
function useDomValue(read: () => string | null): string | null {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 700);
      return () => clearInterval(t);
    },
    () => (typeof document === "undefined" ? null : read()),
    () => null,
  );
}

function waitFor(find: () => Element | null | undefined, timeoutMs = 20_000): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = find();
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 250);
    };
    tick();
  });
}

const notcocaCard = () =>
  [...document.querySelectorAll("li")].find((li) => /notcoca/i.test(li.textContent ?? "") && li.querySelector("[aria-pressed]")) ?? null;

export function DemoTour() {
  const raw = useDemoRaw();
  const state: DemoState | null = raw ? JSON.parse(raw) : null;
  const pathname = usePathname();
  const router = useRouter();
  const status = useDomValue(() => document.querySelector("[data-demo-status]")?.getAttribute("data-demo-status") ?? null);
  const firstRequest = useDomValue(() => document.querySelector("[data-demo-first-status]")?.getAttribute("data-demo-first-status") ?? null);
  const received = useDomValue(() => document.querySelector("#demo-balance")?.getAttribute("data-received") ?? null);
  const ready = useDomValue(() => (document.querySelector("li[data-demo-ready]") ? "1" : null));
  const drv = useRef<Driver | null>(null);

  const step = state?.step ?? null;
  const seen = (k: string) => Boolean(state?.seen?.includes(k));
  const markSeen = (k: string) => patchDemo({ seen: [...(getDemo()?.seen ?? []), k] });

  // Leaving a page or changing step always removes the spotlight.
  useEffect(() => () => {
    drv.current?.destroy();
    drv.current = null;
  }, [pathname, step, status, firstRequest, ready]);

  // Step transitions driven by navigation.
  useEffect(() => {
    if (!step) return;
    if (step === "scan" && /^\/receipts\/(?!new)/.test(pathname)) patchDemo({ step: "receipt" });
    if (step === "receipt" && pathname === "/") patchDemo({ step: "claim-list" });
    if (step === "claim-list" && pathname.startsWith("/claims/")) patchDemo({ step: "agent", claimId: pathname.split("/")[2] });
  }, [step, pathname]);

  // Keep the spotlight glued to elements that grow (folders, product card panels).
  useEffect(() => {
    if (!step) return;
    const t = setInterval(() => drv.current?.refresh(), 500);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const show = (config: Config, start: (d: Driver) => void) => {
      if (cancelled) return;
      drv.current?.destroy();
      const d = driver({ ...BASE, ...config });
      drv.current = d;
      start(d);
    };
    const spot = (s: DriveStep, extra: Config = {}) => show(extra, (d) => d.highlight(s));
    const onClick = (el: Element | undefined, fn: () => void) => el?.addEventListener("click", fn, { once: true });

    (async () => {
      // 1) Dashboard: balance → purchases → Scanner (must be clicked).
      if (step === "intro" && pathname === "/") {
        const el = await waitFor(() => document.querySelector("#demo-balance"));
        if (!el || cancelled) return;
        if (getDemo()?.baseline === undefined) patchDemo({ baseline: Number(el.getAttribute("data-received") ?? 0) });
        show(
          {
            steps: [
              {
                element: "#demo-balance",
                popover: { title: "1 · L'argent récupéré", description: "Tout ce que les marques t'ont déjà remboursé, et ce qui est encore en attente. Remboursements versés via Stripe.", side: "bottom", align: "center", showButtons: ["next"] },
              },
              {
                element: "#activite",
                popover: { title: "2 · Tes demandes", description: "Chaque achat est un dossier : ouvre-le pour voir ses demandes de remboursement et leur statut.", side: "top", align: "center", showButtons: ["next", "previous"] },
              },
              {
                element: "#demo-scan",
                disableActiveInteraction: false,
                popover: { title: "3 · À toi de jouer", description: "Appuie sur « Scanner » pour envoyer un ticket de caisse.", side: "bottom", align: "center", showButtons: [] },
                onHighlighted: (e) => onClick(e, () => patchDemo({ step: "scan" })),
              },
            ],
          },
          (d) => d.drive(),
        );
        return;
      }

      // 2) Scan page: the fictional receipt.
      if (step === "scan" && pathname === "/receipts/new") {
        const el = await waitFor(() => document.querySelector("#demo-ticket"));
        if (!el) return;
        spot(
          {
            element: el,
            disableActiveInteraction: false,
            popover: { title: "Un ticket de démo", description: "Un ticket Carrefour fictif avec deux boissons NotCoca, notre marque de démo. Touche-le : il est lu comme une vraie photo.", side: "top", align: "center", showButtons: [] },
            onHighlighted: (e) => onClick(e, () => drv.current?.destroy()),
          },
        );
        return;
      }

      // 3) Receipt: pick NotCoca, choose a problem, send. The tour only moves on once the card is complete
      //    (Oui + problem + product): no "next" button that would leave the jury stuck.
      if (step === "receipt" && /^\/receipts\/(?!new)/.test(pathname)) {
        if (ready) {
          const el = await waitFor(() => document.querySelector("#demo-submit"));
          if (!el) return;
          spot({
            element: el,
            disableActiveInteraction: false,
            popover: { title: "Envoie ta réclamation", description: "Coche la case (on ne réclame que pour de vrais problèmes) puis envoie : l'agent H Company prend le relais.", side: "top", align: "center", showButtons: [] },
          });
          return;
        }
        const card = await waitFor(notcocaCard, 40_000);
        if (!card || cancelled) return;
        spot({
          element: card,
          disableActiveInteraction: false,
          popover: { title: "Un problème avec NotCoca ?", description: "Touche « Oui » sur la boisson NotCoca, puis choisis le problème de ton choix.", side: "top", align: "center", showButtons: [] },
        });
        return;
      }

      // 4) Back on the dashboard: open the live claim.
      if (step === "claim-list" && pathname === "/") {
        const el = await waitFor(() => document.querySelector("[data-demo-live]"), 30_000);
        if (!el) return;
        spot({
          element: el,
          disableActiveInteraction: false,
          popover: { title: "L'agent est parti", description: "Ouvre le dossier, puis ta demande NotCoca pour regarder l'agent H Company remplir le formulaire en direct.", side: "top", align: "center", showButtons: [] },
        });
        return;
      }

      // 5) Claim page: live agent → missing info → submitted.
      if (step === "agent" && pathname.startsWith("/claims/")) {
        if (status === "submitting" && !seen("agent-live")) {
          const el = await waitFor(() => document.querySelector("#demo-agent"), 90_000);
          if (!el) return;
          const watch = () => {
            markSeen("agent-live");
            drv.current?.destroy();
            window.dispatchEvent(new Event("refundit-demo:open-agent"));
          };
          spot(
            {
              element: el,
              disableActiveInteraction: false,
              popover: { title: "L'agent H Company, en direct", description: "Il ouvre le site de NotCoca, trouve le formulaire et le remplit avec tes infos. Regardons son écran.", side: "bottom", align: "center", showButtons: ["next"], nextBtnText: "Regarder l'agent" },
              onHighlighted: (e) => onClick(e, watch),
            },
            { onNextClick: watch },
          );
        } else if (status === "waiting_input" && !seen("missing")) {
          await new Promise((r) => setTimeout(r, 2500)); // let the jury see the agent stop first
          window.dispatchEvent(new Event("refundit-demo:close-agent"));
          await new Promise((r) => setTimeout(r, 400));
          const el = await waitFor(() => document.querySelector("#demo-missing"));
          if (!el) return;
          spot({
            element: el,
            disableActiveInteraction: false,
            popover: { title: "NotCoca demande une info", description: "Le formulaire exige une réponse que toi seul connais. L'agent n'invente jamais : réponds Oui ou Non, il repart aussitôt.", side: "bottom", align: "center", showButtons: [] },
            onHighlighted: (e) => e?.querySelector("button[type=submit]")?.addEventListener("click", () => { markSeen("missing"); }, { once: true }),
          });
        } else if (status === "submitted") {
          show(
            {
              steps: [
                {
                  popover: {
                    title: "Réclamation déposée ✓",
                    description: "L'agent a envoyé le formulaire NotCoca. Change de camp : tu es maintenant le service client de NotCoca.",
                    showButtons: ["next"],
                    nextBtnText: "Ouvrir le back-office NotCoca",
                  },
                },
              ],
              onNextClick: () => {
                patchDemo({ step: "admin" });
                // Full navigation on purpose: the route handler sets the back-office cookie, then redirects.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/api/demo/notcoca-admin";
              },
            },
            (d) => d.drive(),
          );
        }
        return;
      }

      // 6) NotCoca back-office: refund the request.
      if (step === "admin" && pathname.startsWith("/notcoca/admin")) {
        if (firstRequest === "refunded") {
          show(
            {
              steps: [{ popover: { title: "Remboursement envoyé", description: "NotCoca a payé via Stripe et répondu par e-mail à l'adresse dédiée de ta demande. Retourne sur Refundit pour voir la réponse arriver.", showButtons: ["next"], nextBtnText: "Retour sur Refundit" } }],
              onNextClick: () => {
                patchDemo({ step: "final" });
                router.push("/");
              },
            },
            (d) => d.drive(),
          );
          return;
        }
        const el = await waitFor(() => document.querySelector("#demo-refund"));
        if (!el) return;
        spot({
          element: el,
          disableActiveInteraction: false,
          popover: { title: "Tu es NotCoca", description: "Voici la demande déposée par l'agent. Rembourse-la : prix d'achat + un petit dédommagement.", side: "bottom", align: "center", showButtons: [] },
        });
        return;
      }

      // 7) Dashboard: the brand's email arrives, the balance goes up.
      if (step === "final" && pathname === "/") {
        const el = await waitFor(() => document.querySelector("#demo-balance"));
        if (!el) return;
        const now = Number(el.getAttribute("data-received") ?? 0);
        const base = getDemo()?.baseline ?? 0;
        if (now > base) {
          show(
            {
              steps: [
                {
                  element: "#demo-balance",
                  popover: {
                    title: `+${((now - base) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} !`,
                    description: "NotCoca a répondu par e-mail, Refundit l'a lu et classé : remboursement reçu, ton solde a augmenté.",
                    side: "bottom",
                    align: "center",
                    showButtons: ["next"],
                    nextBtnText: "Voir l'échange",
                  },
                },
              ],
              onNextClick: () => {
                const id = getDemo()?.claimId;
                patchDemo({ step: "final-claim" });
                router.push(id ? `/claims/${id}` : "/");
              },
            },
            (d) => d.drive(),
          );
        } else {
          spot({
            element: "#demo-balance",
            popover: { title: "La réponse arrive…", description: "Refundit relève la boîte mail dédiée à ta demande. Quelques secondes…", side: "bottom", align: "center", showButtons: [] },
          });
        }
        return;
      }

      // 8) Claim page: the whole exchange.
      if (step === "final-claim" && pathname.startsWith("/claims/")) {
        const el = await waitFor(() => document.querySelector("#demo-suivi"));
        if (!el) return;
        spot(
          {
            element: el,
            popover: { title: "Tout l'échange, suivi automatiquement", description: "Ta réclamation, ta réponse, l'e-mail de NotCoca et le remboursement. Sans écrire une ligne toi-même.", side: "top", align: "center", showButtons: ["next"], nextBtnText: "Terminer la démo" },
          },
          { onNextClick: () => patchDemo({ step: "done" }) },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on page / step / page-state changes only
  }, [step, pathname, status, firstRequest, received, ready]);

  // Final step: fetch the brand's email and refresh until the balance goes up.
  useEffect(() => {
    if (step !== "final" || pathname !== "/") return;
    const t = setInterval(async () => {
      await fetch("/api/email/poll", { method: "POST" }).catch(() => undefined);
      router.refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [step, pathname, router]);

  if (!state) return null;
  return (
    <>
      <DemoChip />
      <AnimatePresence>
        {step === "agent" && status === "submitting" && seen("agent-live") && <CancelNote key="note" />}
        {step === "agent" && status === "submitting" && seen("agent-live") && <FunFacts key="facts" />}
        {step === "done" && <EndCard key="end" />}
      </AnimatePresence>
    </>
  );
}

function DemoChip() {
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-4 z-[60] inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12px] font-semibold text-surface shadow-lg">
      <Sparkles className="size-3.5" aria-hidden /> Mode démo
      <button type="button" onClick={() => setDemo(null)} aria-label="Quitter le mode démo" className="ml-1 grid size-6 place-items-center rounded-full bg-white/15 hover:bg-white/25">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function CancelNote() {
  return (
    <motion.div
      initial={{ y: -30, opacity: 0, rotate: -1.5 }}
      animate={{ y: 0, opacity: 1, rotate: -1.5 }}
      exit={{ y: -30, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.4 }}
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[120] w-[min(340px,calc(100%-2rem))] -translate-x-1/2 rounded-[18px] bg-[#FEF3C7] px-4 py-3 text-[14px] text-[#422006] shadow-[0_18px_40px_-12px_rgba(66,32,6,0.45)]"
    >
      <p className="flex items-center gap-2 font-semibold"><Hand className="size-4" aria-hidden /> Tu gardes la main</p>
      <p className="mt-0.5 text-[13px] leading-snug">Tu peux arrêter l&apos;agent à tout moment avec « Arrêter l&apos;agent » : rien n&apos;est envoyé sans toi.</p>
    </motion.div>
  );
}

function EndCard() {
  const router = useRouter();
  async function restart() {
    await fetch("/api/demo/reset", { method: "POST" }).catch(() => undefined);
    setDemo({ step: "intro" });
    router.push("/");
    router.refresh();
  }
  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[#0b0f0d]/60 p-4 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="w-full max-w-[400px] rounded-[28px] bg-surface p-7 text-center shadow-2xl"
      >
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand text-on-brand"><PartyPopper className="size-8" aria-hidden /></span>
        <h2 className="mt-4 text-[22px] font-semibold tracking-tight">Fin de la démo</h2>
        <p className="mt-2 text-[15px] text-muted">Un ticket photographié, une réclamation honnête déposée par un agent, un remboursement reçu. Merci !</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={restart} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink font-semibold text-surface">
            <RotateCcw className="size-4" aria-hidden /> Recommencer la démo
          </button>
          <button type="button" onClick={() => setDemo(null)} className="h-11 rounded-full font-semibold text-muted hover:text-ink">Quitter le mode démo</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Fun facts shown while the agent works. Facts about how Refundit works (from the code and the providers' docs);
// the H cost per claim is the team's own figure.
const FACTS = [
  { k: "≈ 0,11 €", t: "C'est le coût moyen en appels à l'API H Company pour une demande de remboursement." },
  { k: "0 invention", t: "L'agent ne remplit un champ qu'avec tes vraies infos. S'il en manque une, il s'arrête et te la demande." },
  { k: "1 adresse / demande", t: "Les marques répondent sur une adresse e-mail dédiée à ta demande, jamais sur la tienne." },
  { k: "< 1 centime", t: "Marque inconnue ? Un seul appel Linkup trouve son formulaire ou son e-mail de contact." },
  { k: "3 bases ouvertes", t: "Open Food Facts, Open Beauty Facts et Open Prices aident à reconnaître le produit exact de ton ticket." },
  { k: "Stripe", t: "Le remboursement arrive via Stripe (en mode test pour la démo), transférable vers ton compte." },
];

function FunFacts() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FACTS.length), 6500);
    return () => clearInterval(t);
  }, []);
  const f = FACTS[i];
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-[120] w-[min(380px,calc(100%-2rem))] -translate-x-1/2"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12, rotateX: -25 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -12, rotateX: 25 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[20px] bg-[#111714] px-5 py-4 text-[#F2F4F1] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86EFAC]"><Lightbulb className="size-3.5" aria-hidden /> Le savais-tu ?</p>
          <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight">{f.k}</p>
          <p className="mt-1 text-[14px] leading-snug text-[#C9D1CC]">{f.t}</p>
          <div className="mt-3 flex gap-1">
            {FACTS.map((_, n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n === i ? "bg-[#86EFAC]" : "bg-white/15"}`} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
