"use client";
// OWNER: Dev 2. Conversation with the brand, messaging-app style: brand left (avatar), user right,
// system events as centered pills, long messages folded, typing indicator while waiting.
import { useState } from "react";
import { motion } from "motion/react";
import { CircleCheck, Send } from "lucide-react";

export type Message = {
  key: string;
  at: string;
  from: "me" | "brand" | "system";
  title: string;
  body: string;
  sender?: string;
  tag: string | null;
  tone?: "success" | "neutral";
};

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function Body({ text, light }: { text: string; light: boolean }) {
  const [more, setMore] = useState(false);
  const long = text.length > 280 || text.split("\n").length > 6;
  return (
    <>
      <p className={`whitespace-pre-wrap text-[14px] leading-relaxed ${long && !more ? "line-clamp-5" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setMore((m) => !m)} className={`mt-1 text-xs font-semibold ${light ? "text-[#A4ADA7] hover:text-white" : "text-muted hover:text-ink"}`}>
          {more ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </>
  );
}

export function Conversation({ messages, brand, waiting }: { messages: Message[]; brand: string; waiting: boolean }) {
  const initial = brand.charAt(0).toUpperCase();
  return (
    <section className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-raised/90 backdrop-blur">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-sunken text-sm font-bold">{initial}</span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{brand}</p>
          <p className="text-xs text-muted">Service consommateurs</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-3 py-4 sm:px-4">
        {messages.length === 0 && !waiting && (
          <p className="py-6 text-center text-sm text-muted">Les échanges apparaîtront ici dès que ta réclamation sera envoyée.</p>
        )}

        {messages.map((m, k) => {
          if (m.from === "system") {
            return (
              <motion.div key={m.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.04 }} className="flex justify-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${m.tone === "success" ? "bg-brand-soft text-on-brand-soft" : "bg-sunken text-muted"}`}>
                  {m.tone === "success" ? <CircleCheck className="size-3.5" aria-hidden /> : <Send className="size-3" aria-hidden />}
                  {m.title} · {fmt(m.at)}
                </span>
              </motion.div>
            );
          }
          const mine = m.from === "me";
          return (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: k * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
            >
              {!mine && <span className="mb-5 grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-bold">{initial}</span>}
              <div className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                <div className={`rounded-[20px] px-4 py-3 ${mine ? "rounded-br-[6px] bg-[#1F2A24] text-[#F2F4F1]" : "rounded-bl-[6px] bg-sunken text-ink"}`}>
                  <p className={`mb-1 text-xs font-semibold ${mine ? "text-[#A4ADA7]" : "text-muted"}`}>{m.title}</p>
                  <Body text={m.body} light={mine} />
                </div>
                <div className="flex items-center gap-2 px-1">
                  <time className="text-[11px] text-muted">{fmt(m.at)}</time>
                  {m.tag && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${mine ? "bg-sunken text-muted" : "bg-info-soft text-on-info-soft"}`}>{m.tag}</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {waiting && (
          <div className="flex items-end gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-bold">{initial}</span>
            <span className="inline-flex items-center gap-1 rounded-[20px] rounded-bl-[6px] bg-sunken px-4 py-3.5" aria-label={`En attente de la réponse de ${brand}`}>
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="size-1.5 rounded-full bg-line-strong" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
