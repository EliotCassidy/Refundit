"use client";
// Dashboard reminder while the IBAN is missing: inline field, saves through /api/profile/iban.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <motion.section layout className="overflow-hidden rounded-[20px] border border-line bg-raised/90 backdrop-blur">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info-soft text-info"><Landmark className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Ajoute ton IBAN</p>
          <p className="text-[13px] text-muted">Pour recevoir tes remboursements directement sur ton compte.</p>
        </div>
        {!open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Ajouter</Button>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={(e) => { e.preventDefault(); if (ok) void save(); }}
            className="flex flex-col gap-2 border-t border-line px-4 pb-4 pt-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <input
                autoFocus
                value={formatIban(iban)}
                onChange={(e) => setIban(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 34))}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                spellCheck={false}
                className={`mono h-11 w-full rounded-[12px] border bg-surface px-3.5 pr-10 text-sm uppercase outline-none transition focus:bg-raised ${ok ? "border-brand" : "border-line focus:border-ink"}`}
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
