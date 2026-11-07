"use client";
// OWNER: Dev 2. "Transférer vers mon compte": sheet that shows the Stripe balance (available / still pending)
// and pays out the available part to the user's bank account (POST /api/payouts, Stripe TEST mode).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { StripeBadge } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { AnimatedMoney } from "@/components/ui/motion";

type Wallet = { availableCents: number; pendingCents: number; bankLast4: string | null };
const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function TransferButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-surface shadow-[0_6px_16px_-6px_rgba(17,23,20,0.5)] transition hover:bg-ink/90"
      >
        <ArrowUpRight className="size-4" strokeWidth={2.5} aria-hidden />
        Transférer vers mon compte
      </motion.button>
      {typeof document !== "undefined" &&
        createPortal(<AnimatePresence>{open && <Sheet onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    fetch("/api/payouts")
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (stop) return;
        if (ok) setWallet(body);
        else setError(body?.error?.message ?? "Solde indisponible pour le moment.");
      })
      .catch(() => !stop && setError("Solde indisponible pour le moment."));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      stop = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function transfer() {
    setPending(true);
    const res = await fetch("/api/payouts", { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setPending(false);
    if (!res?.ok) return void toast.error(body?.error?.message ?? "Le virement n'a pas pu être lancé.");
    setDone(body.amountCents);
    router.refresh();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#111714]/40 backdrop-blur-[3px] sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Transférer vers mon compte"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(17,23,20,0.2)] sm:rounded-[28px] sm:pb-5"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10 sm:hidden" />
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-black/[0.05] text-muted transition hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {done != null ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-6 text-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                className="grid size-16 place-items-center rounded-full bg-brand text-on-brand"
              >
                <Check className="size-8" strokeWidth={3} aria-hidden />
              </motion.span>
              <p className="text-[20px] font-semibold">Virement lancé</p>
              <p className="text-[15px] text-muted">
                {euros(done)} sont en route vers ton compte{wallet?.bankLast4 ? ` •••• ${wallet.bankLast4}` : ""}.
              </p>
              <Button variant="dark" size="lg" block className="mt-3" onClick={onClose}>Terminé</Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5 pt-2">
              <div className="text-center">
                <p className="text-[15px] text-muted">Disponible</p>
                {wallet ? (
                  <AnimatedMoney cents={wallet.availableCents} className="text-[44px] font-semibold leading-tight tracking-tight" />
                ) : error ? null : (
                  <div className="skeleton mx-auto mt-2 h-11 w-40 rounded-[12px]" />
                )}
              </div>

              {error ? (
                <p className="rounded-[18px] bg-black/[0.04] px-5 py-4 text-center text-[14px] text-muted">{error}</p>
              ) : (
                <div className="divide-y divide-black/[0.05] overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.05]">
                  <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken"><Landmark className="size-[18px]" aria-hidden /></span>
                    <span className="flex-1 text-[15px] text-muted">Vers</span>
                    <span className="text-[15px] font-medium">{wallet ? (wallet.bankLast4 ? <span className="mono">•••• {wallet.bankLast4}</span> : "Compte bancaire") : "…"}</span>
                  </div>
                  {wallet && wallet.pendingCents > 0 && (
                    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3">
                      <span className="flex items-center gap-2 text-[14px] text-muted"><span className="size-2 animate-pulse rounded-full bg-info" />En cours de validation</span>
                      <span className="money text-[15px]">{euros(wallet.pendingCents)}</span>
                    </div>
                  )}
                </div>
              )}

              {wallet && wallet.availableCents === 0 && wallet.pendingCents > 0 && (
                <p className="-mt-2 px-1 text-center text-[13px] text-muted">Stripe valide tes derniers remboursements : ils seront transférables dès qu&apos;ils seront disponibles.</p>
              )}

              <Button variant="dark" size="lg" block loading={pending} disabled={!wallet || wallet.availableCents === 0} onClick={transfer}>
                {wallet && wallet.availableCents > 0 ? `Transférer ${euros(wallet.availableCents)}` : "Transférer"}
              </Button>
              <StripeBadge className="justify-center" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
