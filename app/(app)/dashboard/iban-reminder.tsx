"use client";
// Dashboard reminder while the IBAN is missing: inline field, saves through /api/profile/iban.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { group } from "@/components/ui/list";
import { formatIban, isValidIban } from "@/lib/shared/iban";

export function IbanReminder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [iban, setIban] = useState("");
  const [pending, setPending] = useState(false);
  const ok = isValidIban(iban);

  async function save() {
    setPending(true);
    const res = await fetch("/api/profile/iban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iban }) });
    const body = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) return void toast.error(body?.error?.message ?? "Impossible d'enregistrer l'IBAN");
    toast.success("IBAN enregistré", { description: "Tes remboursements arriveront sur ton compte." });
    router.refresh();
  }

  return (
    <motion.section layout className={group}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex min-h-[60px] w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-black/[0.02]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-soft text-info"><Landmark className="size-[18px]" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Ajoute ton IBAN</span>
          <span className="block truncate text-[13px] text-muted">Pour recevoir tes remboursements</span>
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="shrink-0 text-muted"><ChevronRight className="size-4" aria-hidden /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={(e) => { e.preventDefault(); if (ok) void save(); }}
            className="flex flex-col gap-2 border-t border-black/[0.05] px-5 pb-4 pt-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <input
                autoFocus
                value={formatIban(iban)}
                onChange={(e) => setIban(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 34))}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                spellCheck={false}
                className={`mono h-11 w-full rounded-[12px] bg-black/[0.04] px-3.5 pr-10 text-sm uppercase outline-none ring-1 transition focus:bg-white ${ok ? "ring-brand" : "ring-transparent focus:ring-ink/30"}`}
              />
              {ok && <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-strong" strokeWidth={3} aria-hidden />}
            </div>
            <Button type="submit" variant="dark" disabled={!ok} loading={pending}>Enregistrer</Button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
