"use client";
// OWNER: Dev 2. Jury demo tour (driver.js spotlight: everything around the focused element is dimmed).
// Mounted on every app page and on the NotCoca back-office; it reads the step from localStorage (demo-state)
// and the page state from data-demo-* attributes, so it follows the jury from page to page:
// dashboard (balance → purchases → Scanner) → demo receipt → NotCoca claim → live agent → missing info →
// NotCoca back-office (refund) → back on the dashboard (email + balance) → end.
import "driver.js/dist/driver.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { driver, type Config, type DriveStep, type Driver } from "driver.js";
import { ChevronLeft, ChevronRight, Hand, Lightbulb, PartyPopper, RotateCcw, Sparkles, Timer, X } from "lucide-react";
import { createClient } from "@/lib/shared/supabase/client";
import { getDemo, leaveDemo, patchDemo, setDemo, useDemoRaw, type DemoState } from "./demo-state";

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
  const seenKey = state?.seen?.join(",") ?? "";
  const seen = (k: string) => Boolean(state?.seen?.includes(k));
  const markSeen = (k: string) => patchDemo({ seen: [...(getDemo()?.seen ?? []), k] });

  // Leaving a page or changing step always removes the spotlight.
  useEffect(() => () => {
    drv.current?.destroy();
    drv.current = null;
  }, [pathname, step, status, firstRequest, ready, seenKey]);

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
        if (ready && seen("receipt-done")) {
          const el = await waitFor(() => document.querySelector("#demo-submit"));
          if (!el) return;
          spot({
            element: el,
            disableActiveInteraction: false,
            popover: { title: "Envoie ta réclamation", description: "Coche la case (on ne réclame que pour de vrais problèmes) puis envoie : l'agent H Company prend le relais.", side: "top", align: "center", showButtons: [] },
          });
          return;
        }
        const card = await waitFor(() => document.querySelector("li[data-demo-ready]") ?? notcocaCard(), 40_000);
        if (!card || cancelled) return;
        spot(
          {
            element: card,
            disableActiveInteraction: false,
            popover: {
              title: "Un problème avec NotCoca ?",
              description: ready
                ? "Parfait. Tu peux continuer."
                : "Touche « Oui » sur la boisson NotCoca, puis choisis le problème de ton choix.",
              side: "top",
              align: "center",
              showButtons: ["next"],
              nextBtnText: "J'ai fini",
              disableButtons: ready ? [] : ["next"],
            },
          },
          { onNextClick: () => { if (document.querySelector("li[data-demo-ready]")) markSeen("receipt-done"); } },
        );
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
          window.dispatchEvent(new Event("refundit-demo:close-agent"));
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
        if (firstRequest === "rejected") {
          show(
            {
              steps: [{ popover: { title: "Demande refusée", description: "NotCoca a répondu par e-mail avec son motif. Retourne sur Refundit : la réponse est lue et classée automatiquement.", showButtons: ["next"], nextBtnText: "Retour sur Refundit" } }],
              onNextClick: () => {
                const id = getDemo()?.claimId;
                patchDemo({ step: "final-refused" });
                router.push(id ? `/claims/${id}` : "/");
              },
            },
            (d) => d.drive(),
          );
          return;
        }
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
                    nextBtnText: "Suivant",
                  },
                },
                {
                  popover: {
                    title: "Bon à savoir",
                    description:
                      "Dans la vraie vie, cette étape peut prendre jusqu'à 5 jours ouvrés selon le service client. Mais les marques acceptent dans plus de 70 % des cas, pour clore le ticket au plus vite.",
                    showButtons: ["next"],
                    nextBtnText: "Voir l'échange",
                  },
                },
              ],
              onNextClick: (_el, _step, { driver: d }) => {
                if (!d.isLastStep()) return d.moveNext();
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

      // 7b) Refused by NotCoca: wait for the reply on the claim page, then show it.
      if (step === "final-refused" && pathname.startsWith("/claims/")) {
        const el = await waitFor(() => document.querySelector("#demo-suivi"));
        if (!el) return;
        if (status === "refused") {
          spot(
            {
              element: el,
              popover: {
                title: "Refus reçu et classé",
                description: "La réponse de NotCoca et son motif sont dans le suivi, sans que tu aies rien à trier. C'est rare : les marques acceptent dans plus de 70 % des cas.",
                side: "top",
                align: "center",
                showButtons: ["next"],
                nextBtnText: "Terminer la démo",
              },
            },
            { onNextClick: () => patchDemo({ step: "done" }) },
          );
        } else {
          spot({
            element: el,
            popover: { title: "La réponse arrive…", description: "Refundit relève la boîte mail dédiée à ta demande. Quelques secondes…", side: "top", align: "center", showButtons: [] },
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
  }, [step, pathname, status, firstRequest, received, ready, seenKey]);

  // While the agent works (1st run, then again after the missing info), keep its screen open.
  const forceAgent = step === "agent" && status === "submitting" && seen("agent-live");
  useEffect(() => {
    if (!forceAgent) return;
    const open = () => window.dispatchEvent(new Event("refundit-demo:open-agent"));
    open();
    const t = setInterval(open, 4000);
    return () => clearInterval(t);
  }, [forceAgent]);

  // Final step: fetch the brand's email and refresh until the balance goes up.
  useEffect(() => {
    const waiting = (step === "final" && pathname === "/") || (step === "final-refused" && pathname.startsWith("/claims/") && status !== "refused");
    if (!waiting) return;
    const t = setInterval(async () => {
      await fetch("/api/email/poll", { method: "POST" }).catch(() => undefined);
      router.refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [step, pathname, status, router]);

  if (!state) return null;
  return (
    <>
      <DemoChip />
      {/* Portal: same stacking level as the agent's lightbox (also portaled), so these cards sit above it. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {step === "agent" && seen("agent-live") && <AgentSide key="side" second={seen("missing")} hidden={state.seen ?? []} />}
            {step === "done" && <EndCard key="end" />}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function DemoChip() {
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-4 z-[60] inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12px] font-semibold text-surface shadow-lg">
      <Sparkles className="size-3.5" aria-hidden /> Mode démo
      <button type="button" onClick={() => void leaveDemo()} aria-label="Quitter le mode démo" className="ml-1 grid size-6 place-items-center rounded-full bg-white/15 hover:bg-white/25">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Right-hand column while the agent works (desktop: right of its screen; phone: top + bottom).
 *  Each card stays until the jury closes it with its ×. After the missing info, the 2nd-run cards
 *  take the place of the first "~1 min" card (it no longer applies). */
function AgentSide({ second, hidden }: { second: boolean; hidden: string[] }) {
  const show = (k: string) => !hidden.includes(`x-${k}`);
  const close = (k: string) => () => patchDemo({ seen: [...(getDemo()?.seen ?? []), `x-${k}`] });
  return (
    <>
      <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[120] flex w-[min(340px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 lg:left-auto lg:right-6 lg:top-6 lg:translate-x-0">
        <AnimatePresence initial={false}>
          {second && show("second") && (
            <Note key="second" tone="green" icon={<Sparkles className="size-4" aria-hidden />} title="Cette fois, tout va marcher" onClose={close("second")}>
              L&apos;agent a toutes les infos nécessaires. Cette demande d&apos;infos marche aussi en asynchrone : pas besoin
              d&apos;attendre devant l&apos;écran de l&apos;agent, elle t&apos;attend dans « À faire » sur ton tableau de bord.
            </Note>
          )}
          {second && show("wait2") && (
            <WaitNote key="wait2" title="Encore environ 1 min, tiens bon :)" text="L'agent termine le formulaire NotCoca et l'envoie." onClose={close("wait2")} delay={1.2} />
          )}
          {!second && show("wait1") && (
            <WaitNote key="wait1" title="Environ 1 min en moyenne" text="C'est le temps qu'il faut à l'agent pour arriver à la prochaine étape. Prends une pause et lis les « Le savais-tu ? »." onClose={close("wait1")} />
          )}
          {show("cancel") && (
            <div key="cancel" className="hidden lg:block">
              <Note tone="amber" icon={<Hand className="size-4" aria-hidden />} title="Tu gardes la main" delay={0.6} onClose={close("cancel")}>
                Tu peux arrêter l&apos;agent à tout moment avec « Arrêter l&apos;agent » : rien n&apos;est envoyé sans toi.
              </Note>
            </div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{show("facts") && <FunFacts key="facts" onClose={close("facts")} />}</AnimatePresence>
    </>
  );
}

function Note({ tone, icon, title, children, delay = 0.2, onClose }: { tone: "amber" | "dark" | "green"; icon: React.ReactNode; title: string; children: React.ReactNode; delay?: number; onClose: () => void }) {
  const cls =
    tone === "amber" ? "bg-[#FEF3C7] text-[#422006]" : tone === "green" ? "bg-[#DCFCE7] text-[#14532D]" : "bg-white text-ink ring-1 ring-black/[0.06]";
  return (
    <motion.div
      layout
      initial={{ y: -16, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay }}
      className={`relative rounded-[18px] py-3 pl-4 pr-10 text-[14px] shadow-[0_18px_40px_-14px_rgba(17,23,20,0.45)] ${cls}`}
    >
      <button type="button" onClick={onClose} aria-label="Fermer" className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full opacity-60 transition hover:bg-black/[0.07] hover:opacity-100">
        <X className="size-3.5" aria-hidden />
      </button>
      <p className="flex items-center gap-2 font-semibold">{icon} {title}</p>
      <div className="mt-0.5 text-[13px] leading-snug">{children}</div>
    </motion.div>
  );
}

/** "~1 min" note with a bar that fills over a minute. */
function WaitNote({ title, text, onClose, delay }: { title: string; text: string; onClose: () => void; delay?: number }) {
  return (
    <Note tone="dark" icon={<Timer className="size-4" aria-hidden />} title={title} onClose={onClose} delay={delay}>
      {text}
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-black/[0.07]">
        <motion.span className="block h-full rounded-full bg-brand" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 60, ease: "linear" }} />
      </span>
    </Note>
  );
}

function EndCard() {
  const router = useRouter();
  async function restart() {
    // A new jury = a new throwaway account: back to the login page, which starts the demo again.
    setDemo(null);
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login?demo=1");
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
          <button type="button" onClick={() => void leaveDemo()} className="h-11 rounded-full font-semibold text-muted hover:text-ink">Quitter le mode démo</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Fun facts shown while the agent works. Facts about how Refundit works (from the code and the providers' docs);
// the H cost per claim is the team's own figure.
const FACTS = [
  { k: "≈ 0,11 €", t: "C'est le coût moyen en appels à l'API H Company pour une demande de remboursement." },
  { k: "≈ 1 min", t: "Le temps qu'il faut à l'agent pour ouvrir le site de la marque, trouver le formulaire et le remplir." },
  { k: "0 invention", t: "L'agent ne remplit un champ qu'avec tes vraies infos. S'il en manque une, il s'arrête et te la demande." },
  { k: "≈ 10 s", t: "Pour lire une photo de ticket : chaque ligne est recopiée et les montants sont vérifiés avec le total." },
  { k: "1 adresse / demande", t: "Les marques répondent sur une adresse e-mail dédiée à ta demande, jamais sur la tienne." },
  { k: "Tout est filmé", t: "Chaque écran de l'agent est enregistré : tu peux revoir tout son parcours, étape par étape." },
  { k: "< 1 centime", t: "Marque inconnue ? Un seul appel Linkup trouve son formulaire ou son e-mail de contact." },
  { k: "3 bases ouvertes", t: "Open Food Facts, Open Beauty Facts et Open Prices aident à reconnaître le produit exact de ton ticket." },
  { k: "Honnête par design", t: "Tu confirmes que le problème est réel avant tout envoi : Refundit ne réclame que pour de vrais problèmes." },
  { k: "Stripe", t: "Le remboursement arrive via Stripe (en mode test pour la démo), transférable vers ton compte." },
];

function FunFacts({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0); // restarts the auto-advance after a manual change
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FACTS.length), 8000);
    return () => clearInterval(t);
  }, [tick]);
  const go = (d: number) => {
    setI((n) => (n + d + FACTS.length) % FACTS.length);
    setTick((t) => t + 1);
  };
  const f = FACTS[i];
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-[120] w-[min(340px,calc(100%-2rem))] -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0"
    >
      <div className="relative overflow-hidden rounded-[20px] bg-[#111714] px-5 pb-4 pt-4 text-[#F2F4F1] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86EFAC]"><Lightbulb className="size-3.5" aria-hidden /> Le savais-tu ?</p>
          <div className="flex gap-1">
            <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-7 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"><X className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => go(-1)} aria-label="Fait précédent" className="grid size-7 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><ChevronLeft className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => go(1)} aria-label="Fait suivant" className="grid size-7 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><ChevronRight className="size-4" aria-hidden /></button>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -40) go(1);
              else if (info.offset.x > 40) go(-1);
            }}
            className="min-h-[92px] cursor-grab active:cursor-grabbing"
          >
            <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{f.k}</p>
            <p className="mt-1 text-[14px] leading-snug text-[#C9D1CC]">{f.t}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex gap-1">
          {FACTS.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Fait ${n + 1}`}
              onClick={() => { setI(n); setTick((t) => t + 1); }}
              className={`h-1 flex-1 rounded-full transition-colors ${n === i ? "bg-[#86EFAC]" : "bg-white/15 hover:bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
