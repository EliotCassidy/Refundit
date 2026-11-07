// OWNER: Dev 1. Sélection des articles à problème → problème + vrai produit → POST /api/claims → /claims.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/server";
import { SelectForm } from "./select-form";

export default async function SelectItemsPage({ params }: PageProps<"/receipts/[id]/select">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: receipt }, { data: items }] = await Promise.all([
    supabase.from("receipts").select("id, store_name").eq("id", id).maybeSingle(),
    supabase
      .from("line_items")
      .select("id, raw_label, quantity, total_price_cents, confirmed_product, product_candidates")
      .eq("receipt_id", id)
      .order("position"),
  ]);
  if (!receipt) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/receipts/${id}`} className="text-sm text-neutral-500">← Ticket</Link>
        <h1 className="text-xl font-semibold">Quel produit a un problème ?</h1>
        <p className="text-sm text-neutral-500">Cochez seulement les produits réellement défectueux.</p>
      </div>
      <SelectForm
        receiptId={id}
        items={(items ?? []).map((it) => ({ ...it, quantity: Number(it.quantity) }))}
      />
    </div>
  );
}
