"use client";
// Dashboard top: rolling "Récupéré" balance + round quick actions (banking-app pattern).
import Link from "next/link";
import { motion } from "motion/react";
import { BellRing, CreditCard, ScanLine, User } from "lucide-react";
import { StripeBadge } from "@/components/ui/brand";
import { glass } from "@/components/ui/aurora";
import { AnimatedMoney } from "@/components/ui/motion";

type Props = { firstName: string; received: number; pending: number; openCount: number; needsCount: number };

export function DashboardHero({ firstName, received, pending, openCount, needsCount }: Props) {
  const actions = [
    { href: "/receipts/new", label: "Scanner", Icon: ScanLine, primary: true, badge: 0 },
    { href: needsCount ? "#a-faire" : "/#activite", label: "À faire", Icon: BellRing, primary: false, badge: needsCount },
    { href: "/billing", label: "Abonnement", Icon: CreditCard, primary: false, badge: 0 },
    { href: "/profile", label: "Profil", Icon: User, primary: false, badge: 0 },
  ];

  return (
    <section className={`${glass} relative overflow-hidden px-5 pb-6 pt-7 md:px-8 md:pt-9`}>
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-56 w-[80%] rounded-full bg-brand/15 blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-muted">
          Bonjour {firstName} · Récupéré au total
        </motion.p>
        <AnimatedMoney cents={received} className="text-[48px] leading-none tracking-tight text-ink md:text-[60px]" />
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-on-info-soft">
              <span className="size-1.5 rounded-full bg-info" />
              <AnimatedMoney cents={pending} className="font-semibold" /> en attente · {openCount} demande{openCount > 1 ? "s" : ""}
            </span>
          )}
          <StripeBadge />
        </motion.div>
      </div>

      <div className="relative mt-7 grid grid-cols-4 gap-2">
        {actions.map(({ href, label, Icon, primary, badge }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
            <Link href={href} className="group flex flex-col items-center gap-2 outline-none">
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative grid size-14 place-items-center rounded-full transition-colors ${
                  primary ? "bg-brand text-on-brand shadow-[0_6px_18px_rgba(21,128,61,0.28)]" : "border border-white/80 bg-white/70 text-ink shadow-[0_2px_8px_rgba(17,23,20,0.06)] group-hover:bg-white"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] font-bold text-[#3a2a0e] ring-2 ring-raised">
                    {badge}
                  </span>
                )}
              </motion.span>
              <span className="text-xs font-medium text-ink">{label}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
