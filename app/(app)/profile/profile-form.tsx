"use client";
// Profile settings, banking-app style. Saves through POST /api/profile (Dev 1's API) with the
// optional civility + IBAN. A save bar slides up as soon as something changed.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, CreditCard, Landmark, LogOut, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIban, isValidIban } from "@/lib/shared/iban";
import { createClient } from "@/lib/shared/supabase/client";

export type ProfileValues = {
  civility: "madame" | "monsieur" | "autre" | null;
  first_name: string;
  last_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
};

const CIVILITIES = [
  { value: "madame", label: "Madame" },
  { value: "monsieur", label: "Monsieur" },
  { value: "autre", label: "Non précisé" },
] as const;

const input =
  "h-11 w-full rounded-[12px] border border-transparent bg-sunken/70 px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-ink focus:bg-raised";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="rounded-[20px] border border-line bg-raised/90 p-4 backdrop-blur">{children}</div>
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[13px] font-medium text-muted">
        {label}
        {hint && <span className="text-xs font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ProfileForm({ values, email, maskedIban, unlimited }: { values: ProfileValues; email: string; maskedIban: string | null; unlimited: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<ProfileValues>(values);
  const [saved, setSaved] = useState<ProfileValues>(values);
  const [ibanEditing, setIbanEditing] = useState(false);
  const [iban, setIban] = useState("");
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const set = (p: Partial<ProfileValues>) => setV((s) => ({ ...s, ...p }));
  const ibanOk = isValidIban(iban);
  const ibanBad = iban.replace(/\s/g, "").length >= 15 && !ibanOk;
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(saved) || (ibanEditing && iban.length > 0), [v, saved, ibanEditing, iban]);
  const canSave = dirty && !ibanBad && (!ibanEditing || iban.length === 0 || ibanOk) && v.first_name.trim() && v.last_name.trim();

  async function save() {
    setPending(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        civility: v.civility ?? undefined,
        address_line2: v.address_line2 || undefined,
        iban: ibanEditing && ibanOk ? iban : undefined,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setPending(false);
    if (!res?.ok) return void toast.error(body?.error?.message ?? "Enregistrement impossible");
    setSaved(v);
    if (ibanEditing && ibanOk) {
      setIbanEditing(false);
      setIban("");
    }
    toast.success("Profil enregistré");
    router.refresh();
  }

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function reset() {
    setV(saved);
    setIbanEditing(false);
    setIban("");
  }

  const initial = (v.first_name || email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6 pb-24">
      {/* Identity card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[24px] border border-line bg-raised/90 px-5 py-6 text-center backdrop-blur"
      >
        <div className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-40 w-2/3 rounded-full bg-brand/15 blur-3xl" aria-hidden />
        <span className="relative mx-auto grid size-20 place-items-center rounded-full bg-ink text-3xl font-bold text-surface shadow-[0_10px_30px_rgba(17,23,20,0.18)]">{initial}</span>
        <h1 className="relative mt-3 text-[22px] font-bold tracking-tight">{[saved.first_name, saved.last_name].filter(Boolean).join(" ")}</h1>
        <p className="relative text-sm text-muted">{email}</p>
        <Link
          href="/billing"
          className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${unlimited ? "bg-brand-soft text-on-brand-soft" : "bg-sunken text-ink"}`}
        >
          {unlimited ? <Check className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          {unlimited ? "Refundit Illimité" : "Offre gratuite · passer à Illimité"}
        </Link>
      </motion.section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) void save();
        }}
        className="flex flex-col gap-6"
      >
        <Section title="Identité">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-muted">Civilité</span>
              <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-sunken/70 p-1" role="radiogroup" aria-label="Civilité">
                {CIVILITIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={v.civility === c.value}
                    onClick={() => set({ civility: c.value })}
                    className="relative rounded-[9px] py-2 text-sm font-semibold"
                  >
                    {v.civility === c.value && (
                      <motion.span layoutId="civility-pill" className="absolute inset-0 rounded-[9px] bg-raised shadow-[0_1px_3px_rgba(17,23,20,0.12)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <span className={`relative ${v.civility === c.value ? "text-ink" : "text-muted"}`}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom"><input className={input} autoComplete="given-name" value={v.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
              <Field label="Nom"><input className={input} autoComplete="family-name" value={v.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
            </div>
          </div>
        </Section>

        <Section title="Coordonnées">
          <div className="flex flex-col gap-4">
            <Field label="Téléphone"><input className={input} type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Adresse"><input className={input} autoComplete="address-line1" value={v.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
            <Field label="Complément" hint="facultatif"><input className={input} autoComplete="address-line2" value={v.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Field label="Code postal"><input className={input} inputMode="numeric" autoComplete="postal-code" value={v.postal_code} onChange={(e) => set({ postal_code: e.target.value })} /></Field>
              <Field label="Ville"><input className={input} autoComplete="address-level2" value={v.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-muted">Ces informations servent uniquement à remplir les formulaires des marques. Elles te répondent sur une adresse dédiée, jamais la tienne.</p>
          </div>
        </Section>

        <Section title="Remboursements">
          <AnimatePresence mode="wait" initial={false}>
            {!ibanEditing ? (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${maskedIban ? "bg-brand-soft text-brand-strong" : "bg-info-soft text-info"}`}>
                  <Landmark className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">IBAN</p>
                  <p className={`truncate text-[13px] ${maskedIban ? "mono text-muted" : "text-muted"}`}>{maskedIban ?? "Ajoute-le pour recevoir tes remboursements"}</p>
                </div>
                <Button type="button" size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setIbanEditing(true)}>
                  {maskedIban ? "Modifier" : "Ajouter"}
                </Button>
              </motion.div>
            ) : (
              <motion.div key="edit" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Nouvel IBAN</span>
                <div className="relative">
                  <input
                    autoFocus
                    value={formatIban(iban)}
                    onChange={(e) => setIban(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 34))}
                    placeholder="FR76 3000 6000 0112 3456 7890 189"
                    spellCheck={false}
                    className={`${input} mono pr-10 uppercase ${ibanOk ? "border-brand" : ibanBad ? "border-danger/60" : ""}`}
                  />
                  {ibanOk && <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-strong" strokeWidth={3} aria-hidden />}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${ibanBad ? "text-on-danger-soft" : "text-muted"}`}>
                    {ibanBad ? "Cet IBAN ne semble pas valide." : ibanOk ? "IBAN valide" : "Paiements sécurisés par Stripe"}
                  </span>
                  <button type="button" onClick={() => { setIbanEditing(false); setIban(""); }} className="text-xs font-semibold text-muted hover:text-ink">Annuler</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <Section title="Compte">
          <div className="-m-2 flex flex-col">
            <Link href="/billing" className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 transition hover:bg-sunken/60">
              <span className="grid size-9 place-items-center rounded-full bg-sunken"><CreditCard className="size-[18px]" aria-hidden /></span>
              <span className="flex-1 text-[15px] font-medium">Abonnement</span>
              <span className="text-sm text-muted">{unlimited ? "Illimité" : "Gratuit"}</span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
            <button type="button" onClick={signOut} disabled={signingOut} className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition hover:bg-danger-soft">
              <span className="grid size-9 place-items-center rounded-full bg-danger-soft text-on-danger-soft"><LogOut className="size-[18px]" aria-hidden /></span>
              <span className="flex-1 text-[15px] font-medium text-on-danger-soft">{signingOut ? "Déconnexion…" : "Se déconnecter"}</span>
            </button>
          </div>
        </Section>

        {/* Save bar */}
        <AnimatePresence>
          {dirty && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-2rem)] max-w-[620px] items-center gap-3 rounded-[18px] bg-[#111714] p-2 pl-4 text-[#F2F4F1] shadow-[0_18px_40px_rgba(17,23,20,0.3)]"
            >
              <span className="flex-1 text-sm font-medium">Modifications non enregistrées</span>
              <button type="button" onClick={reset} className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[#A4ADA7] hover:text-white">Annuler</button>
              <Button type="submit" variant="primary" disabled={!canSave} loading={pending}>Enregistrer</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
