"use client";
// OWNER: Dev 2. Claim follow-up as a quiet vertical timeline (replaces the chat bubbles):
// icon on a drawn line, title + date, optional folded text. A pulsing last step while we wait for the brand.
import { useState } from "react";
import { motion } from "motion/react";
import { CircleCheck, CornerDownRight, FileText, Mail, Send, X, type LucideIcon } from "lucide-react";

export type TimelineKind = "sent" | "answer" | "email" | "accepted" | "cancelled";
export type TimelineItem = {
  key: string;
  at: string;
  kind: TimelineKind;
  title: string;
  body?: string;
  meta?: string | null;
};

const ICON: Record<TimelineKind, LucideIcon> = { sent: Send, answer: CornerDownRight, email: Mail, accepted: CircleCheck, cancelled: X };
const TONE: Record<TimelineKind, string> = {
  sent: "bg-ink text-surface",
  answer: "bg-sunken text-ink",
  email: "bg-info-soft text-on-info-soft",
  accepted: "bg-brand text-on-brand",
  cancelled: "bg-danger-soft text-on-danger-soft",
};
const ease = [0.22, 1, 0.36, 1] as const;
const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function Folded({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 4;
  return (
    <div className="mt-2">
      <motion.div
        initial={false}
        animate={{ height: long && !open ? 88 : "auto" }}
        transition={{ duration: 0.3, ease }}
        className="relative overflow-hidden"
      >
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink/80">{text}</p>
        {long && !open && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />}
      </motion.div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[13px] font-semibold text-ink underline-offset-2 hover:underline">
          {open ? "Réduire" : "Lire tout"}
        </button>
      )}
    </div>
  );
}

export function Timeline({ items, waitingFor }: { items: TimelineItem[]; waitingFor: string | null }) {
  if (!items.length && !waitingFor) {
    return <p className="px-5 py-8 text-center text-sm text-muted">Le suivi apparaîtra ici dès que ta réclamation sera envoyée.</p>;
  }
  const total = items.length + (waitingFor ? 1 : 0);
  return (
    <ol className="relative px-5 py-5">
      {/* The line draws itself from top to bottom */}
      <motion.span
        aria-hidden
        className="absolute bottom-9 left-[35px] top-9 w-px origin-top bg-line"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.25 * total, ease }}
      />
      {items.map((it, k) => {
        const Icon = it.kind === "sent" && it.body ? FileText : ICON[it.kind];
        return (
          <motion.li
            key={it.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.1 + k * 0.12 }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            <span className={`relative z-10 grid size-[30px] shrink-0 place-items-center rounded-full ring-4 ring-white ${TONE[it.kind]}`}>
              <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold leading-snug">{it.title}</p>
                <time className="shrink-0 text-xs text-muted">{when(it.at)}</time>
              </div>
              {it.meta && <p className="mt-0.5 truncate text-[13px] text-muted">{it.meta}</p>}
              {it.body && <Folded text={it.body} />}
            </div>
          </motion.li>
        );
      })}
      {waitingFor && (
        <motion.li
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 + items.length * 0.12 }}
          className="relative flex items-center gap-4"
        >
          <span className="relative z-10 grid size-[30px] shrink-0 place-items-center rounded-full bg-white ring-4 ring-white">
            <span className="absolute size-3 animate-ping rounded-full bg-info/40" />
            <span className="relative size-3 rounded-full border-2 border-info bg-white" />
          </span>
          <p className="text-[14px] text-muted">En attente de la réponse de {waitingFor}</p>
        </motion.li>
      )}
    </ol>
  );
}
