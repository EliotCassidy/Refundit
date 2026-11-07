// OWNER: Dev 2. Exchanges with the brand, as a conversation (ours right, the brand's left).
export type Message = {
  key: string;
  at: string;
  from: "me" | "brand";
  title: string;
  body: string;
  sender?: string;
  tag: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function Conversation({ messages, brand, waiting }: { messages: Message[]; brand: string; waiting: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">Échanges avec {brand}</h2>
      {messages.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-line-strong/50 p-5 text-center text-sm text-muted">
          Les messages apparaîtront ici dès que l&apos;agent aura envoyé ta réclamation.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.key} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <article
                className={`flex w-full max-w-[92%] flex-col gap-2 rounded-[22px] p-4 md:max-w-[75%] ${
                  m.from === "me" ? "rounded-br-md bg-ink text-surface" : "rounded-bl-md border border-line bg-raised"
                }`}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-bold">{m.title}</span>
                  <time className={`text-xs ${m.from === "me" ? "opacity-60" : "text-muted"}`}>{fmt(m.at)}</time>
                </header>
                {m.sender && <span className="money -mt-1 text-[11px] text-muted">{m.sender}</span>}
                <details className="group" open={m.from === "brand"}>
                  <summary className={`cursor-pointer list-none text-xs font-semibold ${m.from === "me" ? "opacity-70" : "text-muted"} group-open:hidden`}>
                    Afficher le message
                  </summary>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                </details>
                {m.tag && (
                  <span className={`self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.from === "me" ? "bg-white/15" : "bg-info-soft text-on-info-soft"}`}>
                    {m.tag}
                  </span>
                )}
              </article>
            </li>
          ))}
          {waiting && (
            <li className="flex justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-4 py-2 text-sm text-muted">
                <span className="flex gap-1" aria-hidden>
                  <span className="size-1.5 animate-bounce rounded-full bg-line-strong [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-line-strong [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-line-strong" />
                </span>
                En attente de la réponse de {brand}
              </span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
