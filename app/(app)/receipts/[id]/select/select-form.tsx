"use client";
// OWNER: Dev 1. Sélection : articles cochés → problème + vrai produit (identify / confirm) → POST /api/claims.
// Un appel /identify par article coché, lancés en parallèle (API_CONTRACTS §5).
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ConfirmedProductSchema, ISSUE_LABELS_FR, ISSUE_TYPES, ProductCandidatesSchema,
  type ConfirmedProduct, type IssueType, type ProductCandidates,
} from "@/lib/shared/types";
import { euros } from "@/lib/receipts/format";

export type SelectItem = {
  id: string;
  raw_label: string;
  quantity: number;
  total_price_cents: number;
  confirmed_product: unknown;
  product_candidates: unknown;
};

type ItemState = {
  checked: boolean;
  issueType: IssueType | null;
  description: string;
  candidates: ProductCandidates | null;
  searching: boolean;
  searchError: boolean;
  confirmed: ConfirmedProduct | null;
  confirming: boolean;
};

const parse = <T,>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? (r.data as T) : null;
};

export function SelectForm({ receiptId, items }: { receiptId: string; items: SelectItem[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((it) => [it.id, {
        checked: false, issueType: null, description: "",
        candidates: parse<ProductCandidates>(ProductCandidatesSchema, it.product_candidates),
        searching: false, searchError: false,
        confirmed: parse<ConfirmedProduct>(ConfirmedProductSchema, it.confirmed_product),
        confirming: false,
      }]),
    ),
  );
  const [certified, setCertified] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (id: string, p: Partial<ItemState>) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  async function identify(id: string) {
    patch(id, { searching: true, searchError: false });
    const res = await fetch(`/api/receipts/${receiptId}/identify`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineItemId: id }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.productCandidates) return patch(id, { searching: false, searchError: true });
    patch(id, { searching: false, candidates: body.productCandidates });
  }

  async function confirm(id: string, ean: string | null) {
    patch(id, { confirming: true });
    const res = await fetch(`/api/receipts/${receiptId}/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineItemId: id, ean }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.confirmedProduct) {
      patch(id, { confirming: false });
      return setError(body?.error?.message ?? "Impossible d'enregistrer ce choix. Réessayez.");
    }
    patch(id, { confirming: false, confirmed: body.confirmedProduct });
  }

  function toggle(id: string) {
    const s = state[id];
    patch(id, { checked: !s.checked });
    if (!s.checked && !s.candidates && !s.confirmed && !s.searching) void identify(id);
  }

  const selected = items.filter((it) => state[it.id].checked);
  const complete = (s: ItemState) => s.issueType && s.confirmed && (s.issueType !== "other" || s.description.trim());
  const ready = selected.length > 0 && certified && selected.every((it) => complete(state[it.id]));

  async function submit() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId,
        items: selected.map((it) => ({
          lineItemId: it.id,
          issueType: state[it.id].issueType,
          issueDescription: state[it.id].description.trim() || undefined,
        })),
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setSending(false);
      return setError(body?.error?.message ?? "Envoi impossible. Réessayez.");
    }
    router.push("/claims");
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((it) => {
          const s = state[it.id];
          return (
            <li key={it.id} className={`rounded-xl border p-3 ${s.checked ? "border-foreground" : "border-neutral-500/30"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={s.checked} onChange={() => toggle(it.id)} className="mt-1 size-5 accent-foreground" />
                <span className="flex-1 font-mono text-sm">{it.raw_label}</span>
                <span className="text-sm text-neutral-500">{euros(it.total_price_cents)}</span>
              </label>

              {s.checked && (
                <div className="mt-3 flex flex-col gap-3 pl-8">
                  {/* Problème */}
                  <div className="flex flex-wrap gap-2">
                    {ISSUE_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => patch(it.id, { issueType: t })}
                        className={`rounded-full border px-3 py-1 text-sm ${s.issueType === t ? "border-foreground bg-foreground text-background" : "border-neutral-500/40"}`}>
                        {ISSUE_LABELS_FR[t]}
                      </button>
                    ))}
                  </div>
                  <textarea value={s.description} onChange={(e) => patch(it.id, { description: e.target.value })} rows={2} maxLength={2000}
                    placeholder={s.issueType === "other" ? "Décrivez le problème (obligatoire pour « Autre »)" : "Précisions (facultatif)"}
                    className="rounded-lg border border-neutral-500/40 px-3 py-2 text-sm" />

                  {/* Produit */}
                  <ProductPicker
                    state={s}
                    onPick={(ean) => confirm(it.id, ean)}
                    onRetry={() => identify(it.id)}
                    onChange={() => patch(it.id, { confirmed: null })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} className="mt-0.5 size-5 accent-foreground" />
          Je confirme que ces problèmes sont réels et que je les ai constatés moi-même.
        </label>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="button" disabled={!ready || sending} onClick={submit}
        className="rounded-xl bg-foreground px-4 py-4 text-lg font-medium text-background disabled:opacity-40">
        {sending ? "Envoi…" : `Envoyer ${selected.length > 1 ? `les ${selected.length} réclamations` : "la réclamation"}`}
      </button>
      {selected.length > 0 && !ready && !sending && (
        <p className="text-center text-xs text-neutral-500">Choisissez un problème et le produit pour chaque article coché.</p>
      )}
    </div>
  );
}

function ProductPicker({ state: s, onPick, onRetry, onChange }: {
  state: ItemState; onPick: (ean: string | null) => void; onRetry: () => void; onChange: () => void;
}) {
  if (s.confirmed) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-green-600/40 bg-green-500/10 p-2 text-sm">
        <span>
          {s.confirmed.status === "confirmed"
            ? <>✓ {s.confirmed.name}{s.confirmed.brand ? ` · ${s.confirmed.brand}` : ""}{s.confirmed.quantity ? ` · ${s.confirmed.quantity}` : ""}</>
            : "Produit non identifié : la réclamation citera le libellé du ticket"}
        </span>
        <button type="button" onClick={onChange} className="shrink-0 text-neutral-500 underline">Changer</button>
      </div>
    );
  }
  if (s.searching) return <p className="text-sm text-neutral-500">Recherche du produit…</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Quel est ce produit ?</p>
      {s.searchError && (
        <p className="text-sm text-red-700">
          Recherche impossible. <button type="button" onClick={onRetry} className="underline">Réessayer</button>
        </p>
      )}
      {s.candidates?.uncertain && s.candidates.candidates.length > 0 && (
        <p className="text-xs text-amber-800">À vérifier : {s.candidates.uncertain_reasons.join(", ")}</p>
      )}
      {s.candidates?.candidates.map((c) => (
        <button key={c.ean} type="button" disabled={s.confirming} onClick={() => onPick(c.ean)}
          className="flex items-center gap-3 rounded-lg border border-neutral-500/30 p-2 text-left disabled:opacity-50">
          {c.image_url
            // eslint-disable-next-line @next/next/no-img-element -- images Open Food Facts, domaine externe
            ? <img src={c.image_url} alt="" className="size-12 shrink-0 rounded object-contain" />
            : <span className="size-12 shrink-0 rounded bg-neutral-500/10" />}
          <span className="flex flex-col">
            <span className="text-sm font-medium">{c.name}</span>
            <span className="text-xs text-neutral-500">{[c.brand, c.quantity].filter(Boolean).join(" · ")}</span>
          </span>
        </button>
      ))}
      <button type="button" disabled={s.confirming} onClick={() => onPick(null)} className="text-left text-sm text-neutral-600 underline">
        Je ne trouve pas mon produit
      </button>
    </div>
  );
}
