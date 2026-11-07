"use client";
// OWNER: Dev 1. Premier écran après le scan : une carte par produit (photo, nom, prix) avec le toggle
// « Ce produit a-t-il un problème ? Non / Oui » (Non rouge par défaut, Oui vert → sous-menu problème + produit)
// et « Ce n'est pas le bon produit » (choix du produit).
// Au chargement, /identify part pour chaque produit en parallèle : l'image du 1er candidat s'affiche dès qu'elle arrive.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ConfirmedProductSchema, ISSUE_LABELS_FR, ISSUE_TYPES, ProductCandidatesSchema,
  type ConfirmedProduct, type IssueType, type ProductCandidates,
} from "@/lib/shared/types";
import { euros } from "@/lib/receipts/format";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleCheck, CircleHelp, Package, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { group } from "@/components/ui/list";
import { StoreBanner } from "@/components/ui/store-logo";
import { findStore } from "@/lib/stores";

export type BoardItem = {
  id: string;
  raw_label: string;
  quantity: number;
  total_price_cents: number;
  discount_cents: number;
  confirmed_product: unknown;
  product_candidates: unknown;
};

type Mode = "idle" | "issue" | "product";

type ItemState = {
  mode: Mode;
  issueType: IssueType | null;
  description: string;
  candidates: ProductCandidates | null;
  searching: boolean;
  searchError: boolean;
  searchMessage: string | null; // message d'erreur de la recherche (ex. code-barres inconnu)
  confirmed: ConfirmedProduct | null;
  confirming: boolean;
  auto: boolean; // validé automatiquement (1er très probablement juste)
  returnTo: Mode; // où revenir quand le choix de produit se termine
};

type Manual = { name: string; brand?: string; quantity?: string };
// Secours / recherche : code-barres, nom tapé, ou recherche complète (le produit est déjà connu mais on veut d'autres choix).
type Extra = { ean?: string; query?: string; full?: boolean };

const parse = <T,>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? (r.data as T) : null;
};

const initialState = (it: BoardItem): ItemState => ({
  mode: "idle",
  issueType: null,
  description: "",
  candidates: parse(ProductCandidatesSchema, it.product_candidates),
  searching: false,
  searchError: false,
  searchMessage: null,
  confirmed: parse(ConfirmedProductSchema, it.confirmed_product),
  confirming: false,
  auto: false,
  returnTo: "idle",
});

// Photos Open Food Facts en 200 px au lieu de 400 (≈ 3 fois plus légères sur mobile ; les deux tailles existent).
const small = (url: string | null) => url?.replace(/\.400\.jpg$/, ".200.jpg") ?? null;

// Ce que la carte affiche : le produit confirmé s'il y en a un, sinon le 1er candidat, sinon le libellé du ticket.
function cardInfo(it: BoardItem, s: ItemState) {
  const top = s.candidates?.candidates[0] ?? null;
  if (s.confirmed?.status === "confirmed") {
    return {
      name: s.confirmed.name,
      meta: [s.confirmed.brand, s.confirmed.quantity].filter(Boolean).join(" · ") || null,
      // Photo du produit validé, sinon celle du même produit dans les propositions (photo de secours trouvée après coup).
      image: small(s.confirmed.image_url ?? s.candidates?.candidates.find((c) => c.ean && c.ean === (s.confirmed as { ean?: string | null }).ean)?.image_url ?? null),
      note: s.auto ? "Reconnu automatiquement" : s.confirmed.source === "user" ? "Saisi par vous" : null,
      noteTone: s.auto ? "text-brand-strong" : "text-muted",
    };
  }
  if (s.confirmed?.status === "not_found") {
    return { name: it.raw_label, meta: null, image: null, note: "Produit non identifié", noteTone: "text-muted" };
  }
  if (top) {
    return {
      name: top.name,
      meta: [top.brand, top.quantity].filter(Boolean).join(" · ") || null,
      image: small(top.image_url),
      note: "Le plus probable",
      noteTone: "text-muted",
    };
  }
  return { name: it.raw_label, meta: null, image: null, note: null, noteTone: "" };
}

export type TicketHeader = { store: string; chain?: string | null; date: string; totalCents: number | null };

export function ProductBoard({ receiptId, items, ticket }: { receiptId: string; items: BoardItem[]; ticket?: TicketHeader }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((it) => [it.id, initialState(it)])),
  );
  const [certified, setCertified] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Une fois au montage (pas de double appel /identify en StrictMode).
  const started = useRef(false);

  const patch = (id: string, p: Partial<ItemState>) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  // extra : secours quand le produit n'est pas proposé (code-barres saisi/scanné, ou nom tapé)
  async function identify(id: string, extra: Extra = {}) {
    patch(id, { searching: true, searchError: false, searchMessage: null });
    const res = await fetch(`/api/receipts/${receiptId}/identify`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineItemId: id, ...extra }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.productCandidates) {
      return patch(id, { searching: false, searchError: true, searchMessage: body?.error?.message ?? null });
    }
    const found = body.productCandidates as ProductCandidates;
    patch(id, { searching: false, candidates: found });
    // Cas sûrs (≥ 90 % de justes sur notre éval, ou déjà confirmé à la main par des clients) : validé directement,
    // en « auto » (pas compté dans le cache partagé). Un code-barres tapé est un choix explicite de l'utilisateur.
    if (found.confident && found.candidates[0]) void confirm(id, found.candidates[0].ean, { auto: !extra.ean });
  }

  async function confirm(id: string, ean: string | null, opts: { auto?: boolean; manual?: Manual } = {}) {
    const s = state[id];
    patch(id, { confirming: true });
    const res = await fetch(`/api/receipts/${receiptId}/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItemId: id, ean, manual: opts.manual, auto: opts.auto }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.confirmedProduct) {
      patch(id, { confirming: false });
      return setError(body?.error?.message ?? "Impossible d'enregistrer ce choix. Réessayez.");
    }
    // Une confirmation automatique ne change pas l'écran ; un choix explicite ferme le panneau produit.
    patch(id, {
      confirming: false, confirmed: body.confirmedProduct, auto: Boolean(opts.auto),
      mode: opts.auto ? s.mode : s.returnTo === "issue" ? "issue" : "idle",
    });
  }

  // Au chargement : identification des produits sans candidats, 3 à la fois (pas de rafale vers Open Food Facts).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Dans un microtask : l'effet ne doit pas déclencher de setState synchrone (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      // Déjà connus à l'affichage (choix de clients ou résultat en cache) : un cas sûr est validé tout de suite, en « auto ».
      for (const it of items) {
        const s = state[it.id];
        const top = s.candidates?.candidates[0];
        if (s.candidates?.confident && top && !s.confirmed) void confirm(it.id, top.ean, { auto: true });
      }
      const todo = items.filter((it) => !state[it.id].candidates && !state[it.id].confirmed).map((it) => it.id);
      const worker = async () => {
        for (let id = todo.shift(); id; id = todo.shift()) await identify(id);
      };
      for (let i = 0; i < 3; i++) void worker();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage uniquement
  }, []);

  const claimIds = items.filter((it) => state[it.id].mode === "issue").map((it) => it.id);
  const complete = (s: ItemState) => s.issueType && s.confirmed && (s.issueType !== "other" || s.description.trim());
  const ready = claimIds.length > 0 && certified && claimIds.every((id) => complete(state[id]));

  async function submit() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId,
        items: claimIds.map((id) => ({
          lineItemId: id,
          issueType: state[id].issueType,
          issueDescription: state[id].description.trim() || undefined,
        })),
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setSending(false);
      return setError(body?.error?.message ?? "Envoi impossible. Réessayez.");
    }
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="receipt-paper rounded-[6px] px-4 md:px-6">
        {ticket && (
          <header className="mb-4 flex flex-col items-center gap-1 text-center">
            <div className="mb-2 flex min-h-11 items-center justify-center">
              <StoreBanner store={findStore(ticket.chain, ticket.store)} fallbackName={ticket.chain ?? ticket.store} />
            </div>
            <p className="mono text-base font-semibold uppercase tracking-[0.18em]">{ticket.store}</p>
            <p className="mono text-xs text-muted">{ticket.date} · {items.length} article{items.length > 1 ? "s" : ""}</p>
            <div className="mt-3 w-full border-t-2 border-dashed border-line" />
          </header>
        )}
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <ProductCard
              key={it.id}
              it={it}
              s={state[it.id]}
              patch={(p) => patch(it.id, p)}
              identify={(extra) => identify(it.id, extra)}
              confirm={(ean, opts) => confirm(it.id, ean, opts)}
            />
          ))}
        </ul>
        {ticket && (
          <footer className="mt-5 flex flex-col gap-3">
            <div className="border-t-2 border-dashed border-line" />
            {ticket.totalCents != null && (
              <p className="mono flex items-center justify-between text-base font-semibold">
                <span>TOTAL</span><span>{euros(ticket.totalCents)}</span>
              </p>
            )}
            <p className="mono text-center text-[11px] uppercase tracking-[0.2em] text-muted">Merci de votre visite</p>
          </footer>
        )}
      </div>

      {claimIds.length > 0 && (
        <button
          type="button"
          role="checkbox"
          aria-checked={certified}
          onClick={() => setCertified((c) => !c)}
          className={`${group} flex items-start gap-3.5 px-5 py-4 text-left text-[14px] leading-snug transition-colors hover:bg-white`}
        >
          <motion.span
            animate={{ backgroundColor: certified ? "#111714" : "rgba(17,23,20,0)", borderColor: certified ? "#111714" : "rgba(17,23,20,0.25)" }}
            transition={{ duration: 0.15 }}
            className="mt-px grid size-[22px] shrink-0 place-items-center rounded-[7px] border-2"
          >
            <AnimatePresence>
              {certified && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
                  <Check className="size-3.5 text-white" strokeWidth={3.5} aria-hidden />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
          Je confirme que ces problèmes sont réels et que je les ai constatés moi-même.
        </button>
      )}

      {error && <p className="rounded-[18px] bg-danger-soft px-5 py-3.5 text-sm text-on-danger-soft">{error}</p>}

      <Button type="button" variant="dark" size="lg" block disabled={!ready} loading={sending} onClick={submit} icon={<Send className="size-4" />}>
        {`Envoyer ${claimIds.length > 1 ? `les ${claimIds.length} réclamations` : "la réclamation"}`}
      </Button>
      {claimIds.length > 0 && !ready && !sending && (
        <p className="text-center text-xs text-muted">Pour chaque réclamation : choisissez le problème, puis confirmez le produit.</p>
      )}
      {claimIds.length === 0 && (
        <p className="text-center text-sm text-muted">Touchez « Oui » sur le produit qui pose problème.</p>
      )}
    </div>
  );
}

function ProductCard({ it, s, patch, identify, confirm }: {
  it: BoardItem;
  s: ItemState;
  patch: (p: Partial<ItemState>) => void;
  identify: (extra?: Extra) => Promise<void>;
  confirm: (ean: string | null, opts?: { auto?: boolean; manual?: Manual }) => Promise<void>;
}) {
  const info = cardInfo(it, s);
  const active = s.mode !== "idle";
  // « Oui » = l'utilisateur est en train de réclamer ce produit (panneau ouvert, même pendant un « Changer »).
  const hasIssue = s.mode === "issue" || (s.mode === "product" && s.returnTo === "issue");
  // High confidence: product confirmed, or the 1st candidate is reliable enough to auto-validate.
  const sure = s.confirmed?.status === "confirmed" || (!s.confirmed && Boolean(s.candidates?.confident));

  function enterProduct() {
    patch({ mode: "product", returnTo: s.mode === "issue" ? "issue" : "idle" });
    if (!s.candidates && !s.searching) void identify();
  }

  // Le bouton Oui/Non sert de toggle : « Non » (rouge) par défaut, « Oui » (vert) → le sous-menu s'ouvre.
  function choose(claim: boolean) {
    const want: Mode = claim ? "issue" : "idle";
    if (s.mode !== want) patch({ mode: want });
  }

  return (
    <motion.li
      layout="position"
      className={`rounded-[18px] transition-shadow ${
        sure
          ? "bg-[linear-gradient(135deg,#22C55E,#BBF7D0_45%,#4ADE80)] p-[1.5px] shadow-[0_6px_18px_rgba(34,197,94,0.14)]"
          : "border-2 border-dashed border-line-strong/45"
      }`}
    >
     <div className={`overflow-hidden rounded-[16.5px] ${active ? "bg-white" : "bg-raised"}`}>
      <div className="flex items-center gap-3 p-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-black/[0.03]">
          {s.searching ? (
            <div className="size-8 animate-spin rounded-full border-2 border-line-strong/50 border-t-foreground" />
          ) : (
            // Pas de photo dans les bases Open Facts (ex. produit trouvé sur le web par Linkup) : icône produit,
            // qui reste visible aussi si l'image ne charge pas.
            <div className="relative grid size-full place-items-center">
              <Package className="size-7 text-muted/60" strokeWidth={1.6} aria-hidden />
              {info.image && (
                // eslint-disable-next-line @next/next/no-img-element -- images Open Food Facts / Open Beauty Facts, domaine externe
                <img src={info.image} alt="" className="absolute inset-0 size-full bg-[#fbfaf7] object-contain p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug">
            {it.quantity > 1 && <span className="text-muted">{it.quantity} × </span>}
            {info.name}
          </p>
          {info.meta && <p className="mt-0.5 truncate text-xs text-muted">{info.meta}</p>}
          {!s.searching && (
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sure ? "bg-brand-soft text-on-brand-soft" : "bg-warning-soft text-on-warning-soft"}`}>
              {sure ? <CircleCheck className="size-3" aria-hidden /> : <CircleHelp className="size-3" aria-hidden />}
              {sure ? "Identifié" : "À vérifier"}
            </span>
          )}
          {s.searching ? (
            <p className="mt-0.5 text-xs text-muted">Recherche du produit…</p>
          ) : s.searchError && !s.candidates ? (
            <button type="button" onClick={() => void identify()} className="mt-0.5 text-xs text-on-danger-soft underline">
              Recherche impossible — réessayer
            </button>
          ) : info.note ? (
            <p className={`mt-0.5 text-xs ${info.noteTone}`}>{info.note}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="money text-[15px] font-semibold">{euros(it.total_price_cents)}</p>
          {it.discount_cents > 0 && (
            <p className="text-xs tabular-nums text-brand-strong">remise −{euros(it.discount_cents)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-dashed border-line p-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[14px] text-muted">Ce produit a-t-il un problème&nbsp;?</p>
          <div className="inline-flex rounded-full bg-black/[0.05] p-0.5">
            {([false, true] as const).map((yes) => {
              const on = yes === hasIssue;
              return (
                <button key={String(yes)} type="button" onClick={() => choose(yes)} aria-pressed={on}
                  className="relative rounded-full px-4 py-1.5 text-[14px] font-medium">
                  {on && (
                    <motion.span layoutId={`yn-${it.id}`} transition={{ type: "spring", stiffness: 450, damping: 34 }}
                      className={`absolute inset-0 rounded-full shadow-[0_1px_3px_rgba(17,23,20,0.14)] ${yes ? "bg-brand" : "bg-white"}`} />
                  )}
                  <span className={`relative ${on ? (yes ? "text-on-brand" : "text-ink") : "text-muted"}`}>{yes ? "Oui" : "Non"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {s.mode === "idle" && (
          <button type="button" onClick={enterProduct} className="self-start text-[13px] font-medium text-muted transition hover:text-ink">
            Ce n&apos;est pas le bon produit ?
          </button>
        )}

        <AnimatePresence initial={false}>
        {s.mode === "issue" && (
          <motion.div key="issue" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 overflow-hidden">
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-medium">Quel est le problème ?</p>
              <div className="flex flex-wrap gap-2">
                {ISSUE_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => patch({ issueType: t })}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition ${s.issueType === t ? "bg-ink text-surface ring-ink" : "bg-white text-ink ring-black/[0.08] hover:ring-black/20"}`}>
                    {ISSUE_LABELS_FR[t]}
                  </button>
                ))}
              </div>
              <textarea value={s.description} onChange={(e) => patch({ description: e.target.value })} rows={2} maxLength={2000}
                placeholder={s.issueType === "other" ? "Décrivez le problème (obligatoire pour « Autre »)" : "Précisions (facultatif)"}
                className="rounded-[14px] bg-black/[0.04] px-3.5 py-2.5 text-[14px] outline-none ring-1 ring-transparent transition placeholder:text-muted/70 focus:bg-white focus:ring-ink/30" />
            </div>

            {s.confirmed ? (
              <div className={`flex items-center justify-between gap-2 rounded-[14px] px-3.5 py-3 text-[14px] ${s.confirmed.status === "confirmed" ? "bg-brand-soft" : "bg-black/[0.04]"}`}>
                <span className="min-w-0">
                  {s.confirmed.status === "confirmed" ? (
                    <>
                      {s.auto && <span className="block text-xs text-brand-strong">Reconnu automatiquement</span>}
                      {s.confirmed.source === "user" && <span className="block text-xs text-muted">Saisi par vous</span>}
                      <span className="font-medium">✓ {s.confirmed.name}{s.confirmed.brand ? ` · ${s.confirmed.brand}` : ""}{s.confirmed.quantity ? ` · ${s.confirmed.quantity}` : ""}</span>
                    </>
                  ) : "Produit non identifié : la réclamation citera le libellé du ticket"}
                </span>
                <button type="button" onClick={enterProduct} className="shrink-0 font-medium underline-offset-2 hover:underline">Changer</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Quel est ce produit ?</p>
                <ProductPicker state={s} onPick={(ean) => confirm(ean)} onRetry={() => void identify()} onSearch={(extra) => void identify(extra)} onManual={(m) => confirm(null, { manual: m })} />
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {s.mode === "product" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Quel est ce produit ?</p>
            <ProductPicker state={s} onPick={(ean) => confirm(ean)} onRetry={() => void identify()} onSearch={(extra) => void identify(extra)} onManual={(m) => confirm(null, { manual: m })} />
            <button type="button" onClick={() => patch({ mode: s.returnTo })} className="self-start text-[13px] font-medium text-muted hover:text-ink">
              Annuler
            </button>
          </div>
        )}
      </div>
     </div>
    </motion.li>
  );
}

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;
// BarcodeDetector : Chrome Android oui, Safari iOS non → le bouton photo n'apparaît que s'il existe.
const barcodeDetector = () => (typeof window === "undefined" ? undefined : (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector);

async function readBarcode(file: File): Promise<string | null> {
  const BD = barcodeDetector();
  if (!BD) return null;
  const codes = await new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(await createImageBitmap(file));
  return codes[0]?.rawValue ?? null;
}

function ProductPicker({ state: s, onPick, onRetry, onSearch, onManual }: {
  state: ItemState; onPick: (ean: string | null) => void; onRetry: () => void;
  onSearch: (extra: Extra) => void; onManual: (m: Manual) => void;
}) {
  const [manual, setManual] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [byHand, setByHand] = useState<Manual>({ name: "" });
  const [ean, setEan] = useState("");
  const [query, setQuery] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  // Testé seulement une fois le panneau ouvert (donc dans le navigateur) : pas d'écart avec le rendu serveur.
  const canScan = manual && Boolean(barcodeDetector());

  if (s.searching) return <p className="text-sm text-muted">Recherche du produit… (quelques secondes)</p>;

  // Un produit déjà validé (même en vert, même automatiquement) se corrige ici : on choisit simplement un autre produit.
  const current = s.confirmed;
  const currentEan = current?.status === "confirmed" ? current.ean : null;
  const currentListed = Boolean(currentEan && s.candidates?.candidates.some((c) => c.ean === currentEan));

  return (
    <div className="flex flex-col gap-2">
      {current && !currentListed && (
        <div className="flex items-center gap-2 rounded-[14px] bg-brand-soft px-3 py-2.5 text-sm">
          <CircleCheck className="size-4 shrink-0 text-brand-strong" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs text-muted">Produit actuel</span>
            {current.status === "confirmed"
              ? `${current.name}${current.brand ? ` · ${current.brand}` : ""}${current.quantity ? ` · ${current.quantity}` : ""}`
              : "Produit non identifié"}
          </span>
        </div>
      )}
      {current && <p className="text-xs text-muted">Pas le bon ? Choisissez le bon produit ci-dessous.</p>}
      {s.searchError && (
        <p className="text-sm text-on-danger-soft">
          {s.searchMessage ?? "Recherche impossible."} <button type="button" onClick={onRetry} className="underline">Réessayer</button>
        </p>
      )}
      {s.candidates?.uncertain && s.candidates.candidates.length > 0 && (
        <p className="text-xs text-on-warning-soft">À vérifier : {s.candidates.uncertain_reasons.join(", ")}</p>
      )}
      {s.candidates && !s.candidates.candidates.length && <p className="text-sm text-muted">Aucun produit trouvé.</p>}
      {s.candidates?.candidates.slice(0, showAll ? 5 : 3).map((c) => (
        <button key={c.ean} type="button" disabled={s.confirming} onClick={() => onPick(c.ean)} aria-pressed={c.ean === currentEan}
          className={`flex items-center gap-3 rounded-[14px] p-2 pr-3 text-left ring-1 transition disabled:opacity-50 ${c.ean === currentEan ? "bg-brand-soft ring-brand/50" : "bg-white ring-black/[0.06] hover:ring-black/20"}`}>
          {c.image_url
            // eslint-disable-next-line @next/next/no-img-element -- images Open Food Facts, domaine externe
            ? <img src={small(c.image_url) ?? undefined} alt="" className="size-12 shrink-0 rounded object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
            : <span className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-black/[0.03]"><Package className="size-5 text-muted/60" strokeWidth={1.6} aria-hidden /></span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{c.name}</span>
            <span className="block truncate text-xs text-muted">{[c.brand, c.quantity].filter(Boolean).join(" · ")}</span>
          </span>
          {c.ean === currentEan && <CircleCheck className="size-5 shrink-0 text-brand-strong" aria-label="Produit actuel" />}
        </button>
      ))}

      {!showAll && (s.candidates?.candidates.length ?? 0) > 3 && (
        <button type="button" onClick={() => setShowAll(true)} className="text-left text-sm text-muted underline">
          Voir les {s.candidates!.candidates.length - 3} autres propositions
        </button>
      )}

      {/* Recherche complète (les propositions peuvent venir d'un choix d'un autre client ou du cache) */}
      {s.candidates && s.candidates.candidates.length > 0 && (s.confirmed || s.candidates.candidates.every((c) => c.source === "confirmed_match")) && (
        <button type="button" disabled={s.searching} onClick={() => onSearch({ full: true })} className="text-left text-sm underline">
          Chercher d&apos;autres produits
        </button>
      )}

      {/* Secours : le produit n'est pas dans la liste */}
      {!manual ? (
        <button type="button" onClick={() => setManual(true)} className="text-left text-sm underline">
          Ce n&apos;est aucun de ceux-là ?
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[16px] bg-black/[0.03] p-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ean.trim()) onSearch({ ean: ean.trim() }); }}>
            <input value={ean} onChange={(e) => setEan(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={14}
              placeholder="Code-barres (chiffres sous les barres)" className="h-10 min-w-0 flex-1 rounded-[12px] bg-white px-3 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-ink/30" />
            <button className="rounded-full bg-white px-4 text-sm font-medium ring-1 ring-black/[0.08] hover:ring-black/20">Chercher</button>
          </form>
          {canScan && (
            <label className="cursor-pointer text-sm underline">
              Prendre en photo le code-barres
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setScanMessage(null);
                const code = await readBarcode(file).catch(() => null);
                if (code) { setEan(code); onSearch({ ean: code }); } else setScanMessage("Code-barres illisible : tapez les chiffres.");
              }} />
            </label>
          )}
          {scanMessage && <p className="text-xs text-on-danger-soft">{scanMessage}</p>}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim().length >= 2) onSearch({ query: query.trim() }); }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100}
              placeholder="Nom du produit (ex. Bonne Maman madeleines)" className="h-10 min-w-0 flex-1 rounded-[12px] bg-white px-3 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-ink/30" />
            <button className="rounded-full bg-white px-4 text-sm font-medium ring-1 ring-black/[0.08] hover:ring-black/20">Chercher</button>
          </form>

          {/* Toujours rien : l'utilisateur décrit le produit lui-même (ce sont ses faits, sans EAN) */}
          <form className="flex flex-col gap-2 border-t border-black/[0.06] pt-3"
            onSubmit={(e) => { e.preventDefault(); if (byHand.name.trim().length >= 2) onManual({ name: byHand.name.trim(), brand: byHand.brand?.trim() || undefined, quantity: byHand.quantity?.trim() || undefined }); }}>
            <p className="text-sm font-medium">Toujours introuvable ? Saisissez-le à la main</p>
            <input value={byHand.brand ?? ""} onChange={(e) => setByHand({ ...byHand, brand: e.target.value })} maxLength={60}
              placeholder="Marque (ex. Bonne Maman)" className="h-10 rounded-[12px] bg-white px-3 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-ink/30" />
            <input value={byHand.name} onChange={(e) => setByHand({ ...byHand, name: e.target.value })} maxLength={120} required
              placeholder="Nom du produit (ex. Madeleines pur beurre)" className="h-10 rounded-[12px] bg-white px-3 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-ink/30" />
            <input value={byHand.quantity ?? ""} onChange={(e) => setByHand({ ...byHand, quantity: e.target.value })} maxLength={30}
              placeholder="Format (ex. 300 g)" className="h-10 rounded-[12px] bg-white px-3 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-ink/30" />
            <button disabled={s.confirming || byHand.name.trim().length < 2} className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-surface disabled:opacity-40">
              Utiliser ce produit
            </button>
          </form>
        </div>
      )}

      <button type="button" disabled={s.confirming} onClick={() => onPick(null)} className="text-left text-sm text-muted underline">
        Je ne trouve pas mon produit
      </button>
    </div>
  );
}
