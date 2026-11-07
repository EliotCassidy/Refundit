"use client";
// Onboarding wizard: welcome → civility → name → address → IBAN (optional) → done.
// One question per screen, animated transitions, then POST /api/profile (Dev 1's API).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Landmark, Mail, ScanLine, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { glass } from "@/components/ui/aurora";
import { Logo } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { formatIban, isValidIban } from "@/lib/shared/iban";

type Civility = "madame" | "monsieur" | "autre";
type Data = {
  civility: Civility | null;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  phone: string;
  iban: string;
};

const STEPS = ["welcome", "civility", "name", "address", "iban", "done"] as const;
type Step = (typeof STEPS)[number];
const ease = [0.22, 1, 0.36, 1] as const;

const input =
  "h-[52px] w-full rounded-[14px] border border-black/[0.06] bg-white/80 px-4 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-ink focus:bg-white focus:shadow-[0_0_0_4px_rgba(17,23,20,0.06)]";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </span>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [dir, setDir] = useState(1);
  const [data, setData] = useState<Data>({
    civility: null, first_name: "", last_name: "", address_line1: "", address_line2: "", postal_code: "", city: "", phone: "", iban: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIban, setSavedIban] = useState(false);

  const i = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDir(STEPS.indexOf(to) > i ? 1 : -1);
    setError(null);
    setStep(to);
  };
  const set = (p: Partial<Data>) => setData((d) => ({ ...d, ...p }));

  const valid: Record<Step, boolean> = {
    welcome: true,
    civility: data.civility !== null,
    name: data.first_name.trim().length > 0 && data.last_name.trim().length > 0,
    address:
      data.address_line1.trim().length > 2 &&
      /^\d{5}$/.test(data.postal_code.trim()) &&
      data.city.trim().length > 1 &&
      /^[+]?[0-9][0-9 ().-]{5,19}$/.test(data.phone.trim()),
    iban: data.iban.trim() === "" || isValidIban(data.iban),
    done: true,
  };

  async function save(withIban: boolean) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        civility: data.civility ?? undefined,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || undefined,
        postal_code: data.postal_code,
        city: data.city,
        country: "FR",
        iban: withIban && data.iban.trim() ? data.iban : undefined,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setPending(false);
    if (!res?.ok) return setError(body?.error?.message ?? "Enregistrement impossible. Réessaie.");
    setSavedIban(withIban && Boolean(data.iban.trim()));
    go("done");
  }

  function next() {
    if (!valid[step] || pending) return;
    if (step === "iban") return void save(true);
    go(STEPS[i + 1]);
  }

  const progress = Math.min(i, 4) / 4;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[460px] flex-col justify-center py-2">
      <motion.div layout transition={{ duration: 0.35, ease }} className={`${glass} flex flex-col p-6 sm:p-8`}>
      {/* Progress + back */}
      {step !== "welcome" && step !== "done" && (
        <div className="mb-7 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(STEPS[i - 1])}
            aria-label="Étape précédente"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/80 bg-white/70 text-ink transition hover:bg-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5, ease }} />
          </div>
          <span className="w-10 text-right text-xs font-semibold text-muted">{i}/4</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        className="relative flex flex-1 flex-col"
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease }}
            className="flex flex-1 flex-col"
          >
            {step === "welcome" && <Welcome onStart={() => go("civility")} />}

            {step === "civility" && (
              <Screen title="Comment doit-on s'adresser à toi ?" subtitle="Les marques le demandent souvent dans leurs formulaires.">
                <div className="flex flex-col gap-2.5">
                  {([
                    ["madame", "Madame"],
                    ["monsieur", "Monsieur"],
                    ["autre", "Je préfère ne pas préciser"],
                  ] as const).map(([value, label], k) => {
                    const on = data.civility === value;
                    return (
                      <motion.button
                        key={value}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 * k, ease }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          set({ civility: value });
                          setTimeout(() => go("name"), 220);
                        }}
                        className={`flex h-16 items-center justify-between rounded-[16px] border px-5 text-left text-base font-semibold transition ${
                          on ? "border-ink bg-ink text-surface" : "border-black/[0.06] bg-white/80 hover:bg-white"
                        }`}
                      >
                        {label}
                        <span className={`grid size-6 place-items-center rounded-full border transition ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong/50"}`}>
                          {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </Screen>
            )}

            {step === "name" && (
              <Screen title="Enchanté ! Comment t'appelles-tu ?" subtitle="Ton nom apparaîtra sur les réclamations envoyées aux marques.">
                <div className="flex flex-col gap-4">
                  <label>
                    <Label>Prénom</Label>
                    <input autoFocus className={input} autoComplete="given-name" value={data.first_name} onChange={(e) => set({ first_name: e.target.value })} placeholder="Camille" />
                  </label>
                  <label>
                    <Label>Nom</Label>
                    <input className={input} autoComplete="family-name" value={data.last_name} onChange={(e) => set({ last_name: e.target.value })} placeholder="Martin" />
                  </label>
                </div>
              </Screen>
            )}

            {step === "address" && (
              <Screen title={`Où habites-tu, ${data.first_name.trim() || "toi"} ?`} subtitle="Certaines marques envoient leurs bons d'achat par courrier.">
                <div className="flex flex-col gap-4">
                  <label>
                    <Label>Adresse</Label>
                    <input autoFocus className={input} autoComplete="address-line1" value={data.address_line1} onChange={(e) => set({ address_line1: e.target.value })} placeholder="12 rue des Roses" />
                  </label>
                  <label>
                    <Label hint="facultatif">Complément</Label>
                    <input className={input} autoComplete="address-line2" value={data.address_line2} onChange={(e) => set({ address_line2: e.target.value })} placeholder="Bâtiment, étage…" />
                  </label>
                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <label>
                      <Label>Code postal</Label>
                      <input className={input} inputMode="numeric" maxLength={5} autoComplete="postal-code" value={data.postal_code} onChange={(e) => set({ postal_code: e.target.value.replace(/\D/g, "") })} placeholder="75011" />
                    </label>
                    <label>
                      <Label>Ville</Label>
                      <input className={input} autoComplete="address-level2" value={data.city} onChange={(e) => set({ city: e.target.value })} placeholder="Paris" />
                    </label>
                  </div>
                  <label>
                    <Label hint="demandé par les marques">Téléphone</Label>
                    <input className={input} type="tel" autoComplete="tel" value={data.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="06 12 34 56 78" />
                  </label>
                </div>
              </Screen>
            )}

            {step === "iban" && (
              <Screen title="Où verser tes remboursements ?" subtitle="Ajoute ton IBAN pour recevoir l'argent directement sur ton compte.">
                <IbanField value={data.iban} onChange={(iban) => set({ iban })} />
                <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted">
                  <li className="flex items-center gap-2.5"><ShieldCheck className="size-4 text-brand-strong" aria-hidden /> Paiements sécurisés par Stripe</li>
                  <li className="flex items-center gap-2.5"><Landmark className="size-4 text-brand-strong" aria-hidden /> Facultatif maintenant, nécessaire pour être remboursé</li>
                </ul>
              </Screen>
            )}

            {step === "done" && <Done firstName={data.first_name} ibanSaved={savedIban} onHome={() => { router.replace("/"); router.refresh(); }} />}
          </motion.div>
        </AnimatePresence>

        {/* Footer actions */}
        {step !== "welcome" && step !== "done" && (
          <div className="mt-8 flex flex-col gap-2">
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-on-danger-soft">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            {step !== "civility" && (
              <Button type="submit" variant="dark" size="lg" block disabled={!valid[step]} loading={pending && step === "iban"}>
                {step === "iban" ? (data.iban.trim() ? "Enregistrer mon IBAN" : "Terminer") : "Continuer"}
                {step !== "iban" && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            )}
            {step === "iban" && (
              <Button type="button" variant="ghost" size="md" block disabled={pending} onClick={() => save(false)}>
                Plus tard
              </Button>
            )}
          </div>
        )}
      </form>
      </motion.div>
    </div>
  );
}

function Screen({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mb-7 mt-2 text-[15px] text-muted">{subtitle}</p>
      {children}
    </div>
  );
}

function IbanField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const clean = value.replace(/\s/g, "");
  const ok = clean.length > 0 && isValidIban(value);
  const bad = clean.length >= 15 && !ok;
  return (
    <label>
      <Label hint="facultatif">IBAN</Label>
      <div className="relative">
        <input
          autoFocus
          className={`${input} mono pr-12 uppercase tracking-wide ${bad ? "border-danger/60" : ok ? "border-brand" : ""}`}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={formatIban(value)}
          onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 34))}
          placeholder="FR76 3000 6000 0112 3456 7890 189"
        />
        <AnimatePresence>
          {ok && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-brand text-on-brand"
            >
              <Check className="size-4" strokeWidth={3} aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`mt-1.5 block text-xs ${bad ? "text-on-danger-soft" : "text-muted"}`}>
        {bad ? "Cet IBAN ne semble pas valide : vérifie les chiffres." : ok ? "IBAN valide" : "Sur ton RIB ou dans ton appli bancaire."}
      </span>
    </label>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  const steps = [
    { Icon: ScanLine, title: "Scanne ton ticket", text: "Une photo suffit, on lit chaque ligne." },
    { Icon: Zap, title: "Coche le produit", text: "Notre agent écrit à la marque pour toi." },
    { Icon: Mail, title: "Reçois ton argent", text: "Les réponses et le remboursement arrivent ici." },
  ];
  return (
    <div className="flex flex-col">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }} className="inline-flex w-fit items-center rounded-full border border-white/80 bg-white/70 py-1.5 pl-1.5 pr-3 shadow-sm">
        <Logo className="scale-[0.85] origin-left" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease }}
        className="mt-6 text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[40px]"
      >
        On récupère{" "}
        <span className="bg-gradient-to-r from-[#15803D] via-[#22C55E] to-[#65A30D] bg-clip-text text-transparent">ton argent.</span>
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, ease }} className="mt-3 text-[15px] text-muted">
        Un produit abîmé, périmé ou décevant ? Refundit s&apos;occupe de la réclamation à ta place.
      </motion.p>

      <div className="mt-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Comment ça marche</p>
        <ol className="relative flex flex-col gap-4">
          <motion.span
            className="absolute bottom-5 left-[19px] top-5 w-px origin-top bg-gradient-to-b from-brand via-brand/40 to-transparent"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.35, duration: 0.8, ease }}
            aria-hidden
          />
          {steps.map(({ Icon, title, text }, k) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + k * 0.12, ease }}
              className="relative flex items-start gap-3.5"
            >
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-white bg-white text-brand-strong shadow-[0_4px_12px_rgba(17,23,20,0.08)]">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="pt-1">
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="block text-[13px] text-muted">{text}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, ease }} className="mt-8">
        <Button type="button" variant="dark" size="lg" block onClick={onStart}>
          Commencer <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="mt-3 text-center text-xs text-muted">2 minutes · tes données servent uniquement à remplir les formulaires des marques</p>
      </motion.div>
    </div>
  );
}

function Done({ firstName, ibanSaved, onHome }: { firstName: string; ibanSaved: boolean; onHome: () => void }) {
  const dots = Array.from({ length: 14 }, (_, k) => {
    const angle = (k / 14) * Math.PI * 2;
    return { x: Math.cos(angle) * 90, y: Math.sin(angle) * 90, c: ["#22C55E", "#F59E0B", "#4C8DF6", "#F2772F"][k % 4] };
  });
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
      <div className="relative grid size-28 place-items-center">
        {dots.map((d, k) => (
          <motion.span
            key={k}
            className="absolute size-2.5 rounded-full"
            style={{ background: d.c }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: d.x, y: d.y, opacity: [0, 1, 0], scale: [0, 1, 0.6] }}
            transition={{ delay: 0.35, duration: 1, ease: "easeOut" }}
          />
        ))}
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="grid size-28 place-items-center rounded-full bg-brand text-on-brand shadow-[0_14px_40px_rgba(34,197,94,0.4)]">
          <svg viewBox="0 0 24 24" className="size-14" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.5, ease }} />
          </svg>
        </motion.span>
      </div>
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Tout est prêt{firstName.trim() ? `, ${firstName.trim()}` : ""} !</h1>
        <p className="mt-2 text-[15px] text-muted">
          {ibanSaved ? "Tes remboursements arriveront directement sur ton compte." : "Pense à ajouter ton IBAN avant ton premier remboursement."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link href="/receipts/new" className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-brand px-5 font-semibold text-on-brand transition active:scale-[0.98]">
          <Sparkles className="size-4" aria-hidden /> Scanner mon premier ticket
        </Link>
        <Button type="button" variant="ghost" size="md" block onClick={onHome}>Aller au tableau de bord</Button>
      </div>
    </div>
  );
}
