// OWNER: Dev 1. Premier écran après le scan : magasin, date, total, puis une carte par produit
// (photo du 1er candidat, nom, prix) avec « Faire une réclamation » / « Ce n'est pas le bon produit ».
import Link from "next/link";
import { notFound } from "next/navigation";
import { Candy } from "@/components/ui/brand";
import { createClient } from "@/lib/shared/supabase/server";
import { euros, frDate } from "@/lib/receipts/format";
import type { ReceiptExtraction } from "@/lib/receipts/parse";
import { ProductBoard, type BoardItem } from "./product-board";

export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: receipt }, { data: items }] = await Promise.all([
    supabase.from("receipts").select("id, status, store_name, purchased_at, total_cents, error, raw_parse").eq("id", id).maybeSingle(),
    supabase
      .from("line_items")
      .select("id, position, raw_label, quantity, total_price_cents, confirmed_product, product_candidates")
      .eq("receipt_id", id)
      .order("position"),
  ]);
  if (!receipt) notFound();

  if (receipt.status !== "parsed") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Ticket</h1>
        <p className="rounded-[20px] bg-danger-soft p-3 text-sm text-on-danger-soft">
          {receipt.status === "failed" ? "Ce ticket n'a pas pu être lu." : "Lecture en cours…"}
        </p>
        <Link href="/receipts/new" className="rounded-[20px] bg-ink px-4 py-3 text-center font-medium text-surface">
          Reprendre une photo
        </Link>
      </div>
    );
  }

  // Remises, heure : l'extraction complète (raw_parse) indexée par position.
  const x = (receipt.raw_parse ?? {}) as ReceiptExtraction | null;
  const discountOf = (position: number, label: string) => {
    const it = x?.items?.[position];
    return it && it.raw_label.trim() === label ? it.discount_cents : 0;
  };
  const boardItems: BoardItem[] = (items ?? []).map((it) => ({
    id: it.id,
    raw_label: it.raw_label,
    quantity: Number(it.quantity),
    total_price_cents: it.total_price_cents,
    discount_cents: discountOf(it.position, it.raw_label),
    confirmed_product: it.confirmed_product,
    product_candidates: it.product_candidates,
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="panel panel-check flex items-center gap-4 rounded-[20px] p-5 md:p-6">
        <Candy kind="check" size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold tracking-tight md:text-[30px]">Coche</h1>
          <p className="text-sm text-[#5B635E]">le produit qui a un problème.</p>
        </div>
      </header>

      {/* Receipt stub */}
      <div className="flex items-center justify-between gap-3 rounded-[20px] border border-dashed border-line-strong/60 bg-raised px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{receipt.store_name ?? "Ticket de caisse"}</p>
          <p className="mono text-xs text-muted">
            {[frDate(receipt.purchased_at), x?.time].filter(Boolean).join(" · ") || "Date non lue"} · {boardItems.length} article{boardItems.length > 1 ? "s" : ""}
          </p>
        </div>
        {receipt.total_cents != null && <span className="mono shrink-0 text-lg font-semibold">{euros(receipt.total_cents)}</span>}
      </div>

      {x?.needs_review && (
        <div className="rounded-[20px] border border-warning/50 bg-warning-soft p-3 text-sm text-on-warning-soft">
          Certains montants n&apos;ont pas pu être vérifiés (ticket coupé ou peu lisible). Vérifiez la liste avant de continuer.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quel produit a un problème ?</h2>
        <p className="text-sm text-muted">Identifiés à partir du ticket. Corrigez si besoin, puis touchez « Oui » sur celui qui pose problème.</p>
        <ProductBoard receiptId={receipt.id} items={boardItems} />
      </div>
    </div>
  );
}
