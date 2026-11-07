"use client";
// Dashboard top: rolling "Récupéré" balance + round quick actions (banking-app pattern).
import Link from "next/link";
import { motion } from "motion/react";
import { BellRing, CreditCard, ScanLine, User } from "lucide-react";
import { AnimatedMoney } from "@/components/ui/motion";
import { TransferButton } from "./transfer-sheet";

type Props = { firstName: string; received: number; pending: number; openCount: number; needsCount: number; hasIban: boolean };

export function DashboardHero({ firstName, received, pending, openCount, needsCount, hasIban }: Props) {
  const total = received + pending;
  const actions = [
    { href: "/receipts/new", label: "Scanner", Icon: ScanLine, primary: true, badge: 0 },
    { href: needsCount ? "#a-faire" : "/#activite", label: "À faire", Icon: BellRing, primary: false, badge: needsCount },
    { href: "/billing", label: "Abonnement", Icon: CreditCard, primary: false, badge: 0 },
    { href: "/profile", label: "Profil", Icon: User, primary: false, badge: 0 },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[32px] bg-white/85 px-5 pb-6 pt-8 shadow-[0_1px_2px_rgba(17,23,20,0.04),0_24px_60px_-28px_rgba(17,23,20,0.28)] ring-1 ring-black/[0.05] backdrop-blur-xl md:px-10 md:pt-10"
    >
      {/* Soft brand glow behind the balance */}
      <div className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(34,197,94,0.22),transparent)]" aria-hidden />

      <div className="relative flex flex-col items-center text-center">
        <p className="text-[15px] text-muted">Bonjour {firstName}</p>
        <p className="mt-4 text-[13px] font-medium text-muted">Récupéré au total</p>
        <AnimatedMoney cents={received} className="mt-1 text-[56px] font-semibold leading-none tracking-tight text-ink md:text-[64px]" />
        {hasIban && (
          <div className="mt-5">
            <TransferButton />
          </div>
        )}
      </div>

      {/* Received vs pending */}
      <div className="relative mx-auto mt-7 w-full max-w-[420px]">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <motion.span
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: `${total ? (received / total) * 100 : 0}%` }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.span
            className="pending-stripes h-full bg-info/70"
            initial={{ width: 0 }}
            animate={{ width: `${total ? (pending / total) * 100 : 0}%` }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="text-left">
            <p className="flex items-center gap-1.5 text-[12px] text-muted"><span className="size-2 rounded-full bg-brand" />Reçu</p>
            <AnimatedMoney cents={received} className="text-[16px] font-semibold text-brand-strong" />
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-[12px] text-muted">
              <span className={`size-2 rounded-full bg-info ${pending ? "animate-pulse" : ""}`} />
              En attente{openCount ? ` · ${openCount} demande${openCount > 1 ? "s" : ""}` : ""}
            </p>
            <AnimatedMoney cents={pending} className={`text-[16px] font-semibold ${pending ? "text-ink" : "text-muted"}`} />
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-6 h-px w-full max-w-[420px] bg-black/[0.06]" />

      <div className="relative mx-auto mt-5 grid w-full max-w-[420px] grid-cols-4 gap-2">
        {actions.map(({ href, label, Icon, primary, badge }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
            <Link href={href} className="group flex flex-col items-center gap-2 outline-none">
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`relative grid size-14 place-items-center rounded-full transition-colors ${
                  primary ? "bg-brand text-on-brand shadow-[0_6px_18px_rgba(21,128,61,0.28)]" : "bg-black/[0.04] text-ink group-hover:bg-black/[0.07]"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-warning px-1 text-[11px] font-bold text-[#3a2a0e] ring-2 ring-white">
                    {badge}
                  </span>
                )}
              </motion.span>
              <span className="text-[13px] text-ink">{label}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
