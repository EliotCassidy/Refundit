// OWNER: Dev 1. Premier écran après le scan : magasin, date, total, puis une carte par produit
// (photo du 1er candidat, nom, prix) avec « Faire une réclamation » / « Ce n'est pas le bon produit ».
import Link from "next/link";
import { notFound } from "next/navigation";
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
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {receipt.status === "failed" ? "Ce ticket n'a pas pu être lu." : "Lecture en cours…"}
        </p>
        <Link href="/receipts/new" className="rounded-xl bg-foreground px-4 py-3 text-center font-medium text-background">
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{receipt.store_name ?? "Ticket de caisse"}</h1>
        <p className="text-sm text-neutral-500">
          {[frDate(receipt.purchased_at), x?.time].filter(Boolean).join(" à ") || "Date non lue"}
          {receipt.total_cents != null && <> · Total {euros(receipt.total_cents)}</>}
        </p>
      </div>

      {x?.needs_review && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Certains montants n&apos;ont pas pu être vérifiés (ticket coupé ou peu lisible). Vérifiez la liste avant de continuer.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quel produit a un problème ?</h2>
        <p className="text-sm text-neutral-500">Identifiés à partir du ticket. Corrigez si besoin, puis touchez « Oui » sur celui qui pose problème.</p>
        <ProductBoard receiptId={receipt.id} items={boardItems} />
      </div>
    </div>
  );
}
