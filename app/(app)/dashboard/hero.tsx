"use client";
// Dashboard top: rolling "Récupéré" balance + round quick actions (banking-app pattern).
import Link from "next/link";
import { motion } from "motion/react";
import { BellRing, CreditCard, ScanLine, User } from "lucide-react";
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
    <section className="flex flex-col items-center pt-2">
      <div className="flex flex-col items-center gap-2 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[15px] text-muted">
          Bonjour {firstName}
        </motion.p>
        <AnimatedMoney cents={received} className="text-[52px] font-semibold leading-none tracking-tight text-ink md:text-[60px]" />
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-1 flex flex-col items-center gap-2 text-[13px] text-muted">
          <span>récupérés au total</span>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-on-info-soft">
              <span className="size-1.5 animate-pulse rounded-full bg-info" />
              <AnimatedMoney cents={pending} className="font-semibold" /> en attente · {openCount} demande{openCount > 1 ? "s" : ""}
            </span>
          )}
        </motion.div>
      </div>

      <div className="mt-8 grid w-full max-w-[420px] grid-cols-4 gap-2">
        {actions.map(({ href, label, Icon, primary, badge }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
            <Link href={href} className="group flex flex-col items-center gap-2 outline-none">
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative grid size-14 place-items-center rounded-full transition-colors ${
                  primary ? "bg-brand text-on-brand shadow-[0_6px_18px_rgba(21,128,61,0.28)]" : "bg-white/80 text-ink shadow-[0_1px_2px_rgba(17,23,20,0.04),0_8px_20px_-12px_rgba(17,23,20,0.25)] ring-1 ring-black/[0.05] group-hover:bg-white"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] font-bold text-[#3a2a0e] ring-2 ring-raised">
                    {badge}
                  </span>
                )}
              </motion.span>
              <span className="text-[13px] text-ink">{label}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
