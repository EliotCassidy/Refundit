// OWNER: Dev 1. Premier écran après le scan : magasin, date, total, puis une carte par produit
// (photo du 1er candidat, nom, prix) avec « Faire une réclamation » / « Ce n'est pas le bon produit ».
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/server";
import { frDate } from "@/lib/receipts/format";
import type { ReceiptExtraction } from "@/lib/receipts/parse";
import type { Json } from "@/lib/shared/database.types";
import { knownCandidates } from "@/lib/receipts/products";
import { resolveBrand } from "@/lib/brands";
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
  // Photo instantanée : pour les produits pas encore identifiés, ce qu'on sait déjà de ce libellé (choix manuels de clients,
  // sinon dernier résultat en cache), même ordre que /identify. Enregistré sur l'article : /confirm le retrouve.
  const chain = x?.store?.chain ?? receipt.store_name;
  const known = await Promise.all(
    (items ?? []).map(async (it) => {
      if (it.product_candidates || it.confirmed_product) return null;
      const registryBrand = (await resolveBrand(it.raw_label, null).catch(() => null))?.name ?? null;
      const found = await knownCandidates(chain, it.raw_label, registryBrand).catch(() => null);
      if (found) await supabase.from("line_items").update({ product_candidates: found as unknown as Json }).eq("id", it.id);
      return found;
    }),
  );

  const boardItems: BoardItem[] = (items ?? []).map((it, i) => ({
    id: it.id,
    raw_label: it.raw_label,
    quantity: Number(it.quantity),
    total_price_cents: it.total_price_cents,
    discount_cents: discountOf(it.position, it.raw_label),
    confirmed_product: it.confirmed_product,
    product_candidates: known[i] ?? it.product_candidates,
  }));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="text-center">
        <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Quel produit a un problème ?</h1>
        <p className="mt-1.5 text-[15px] text-muted">Vérifie les produits trouvés, puis touche « Oui » sur celui qui pose problème.</p>
      </header>

      {x?.needs_review && (
        <div className="rounded-[14px] border border-warning/50 bg-warning-soft p-3 text-sm text-on-warning-soft">
          Certains montants n&apos;ont pas pu être vérifiés (ticket coupé ou peu lisible). Vérifie la liste avant de continuer.
        </div>
      )}

      <ProductBoard
        receiptId={receipt.id}
        items={boardItems}
        ticket={{
          store: receipt.store_name ?? "Ticket de caisse",
          date: [frDate(receipt.purchased_at), x?.time].filter(Boolean).join(" · ") || "Date non lue",
          totalCents: receipt.total_cents,
        }}
      />
    </div>
  );
}
