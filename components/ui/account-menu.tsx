"use client";
// Shared UI. "Compte" button, top right: profile, current plan, subscription, sign out.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CreditCard, LogOut, Sparkles, User } from "lucide-react";
import { createClient } from "@/lib/shared/supabase/client";

export function AccountMenu({ firstName, email, unlimited }: { firstName: string | null; email: string; unlimited: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  const initial = (firstName || email).charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-raised/80 py-1 pl-1 pr-3 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(17,23,20,0.05)] backdrop-blur transition hover:bg-raised"
      >
        <span className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-bold text-surface">{initial}</span>
        <span className="hidden sm:inline">Compte</span>
        <ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right overflow-hidden rounded-[18px] border border-line bg-raised p-1.5 shadow-[0_18px_40px_rgba(17,23,20,0.14)]"
          >
            <div className="px-3 pb-2 pt-2.5">
              <p className="truncate text-sm font-semibold">{firstName ?? "Mon compte"}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <Link
              href="/billing"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`mx-1 mb-1.5 flex items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 ${unlimited ? "bg-brand-soft" : "bg-sunken"}`}
            >
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Mon offre</span>
                <span className="block text-sm font-semibold">{unlimited ? "Illimité" : "Gratuit · 1 scan / mois"}</span>
              </span>
              {!unlimited && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-on-brand">
                  <Sparkles className="size-3" aria-hidden /> Passer à Illimité
                </span>
              )}
            </Link>
            {[
              { href: "/profile", label: "Profil", Icon: User },
              { href: "/billing", label: "Abonnement", Icon: CreditCard },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-ink transition hover:bg-sunken"
              >
                <Icon className="size-4 text-muted" aria-hidden /> {label}
              </Link>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm font-medium text-on-danger-soft transition hover:bg-danger-soft"
            >
              <LogOut className="size-4" aria-hidden /> Se déconnecter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
