// OWNER: Dev 1. Ticket lu : magasin, date, articles (libellés tels qu'imprimés), puis « Signaler un problème ».
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/shared/supabase/server";
import { euros, frDate } from "@/lib/receipts/format";

// Ce que la page lit dans receipts.raw_parse (ReceiptExtraction, lib/receipts/parse.ts)
type Extraction = {
  time?: string | null;
  needs_review?: boolean;
  check_errors?: string[];
  items?: { raw_label: string; discount_cents: number; price_cents: number }[];
};

export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: receipt }, { data: items }] = await Promise.all([
    supabase.from("receipts").select("id, status, store_name, purchased_at, total_cents, error, raw_parse").eq("id", id).maybeSingle(),
    supabase.from("line_items").select("id, position, raw_label, quantity, total_price_cents").eq("receipt_id", id).order("position"),
  ]);
  if (!receipt) notFound();

  if (receipt.status !== "parsed") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Ticket</h1>
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {receipt.status === "failed" ? "Ce ticket n'a pas pu être lu." : "Lecture en cours…"}
        </p>
        <Link href="/receipts/new" className="rounded-xl bg-black px-4 py-3 text-center font-medium text-white">
          Reprendre une photo
        </Link>
      </div>
    );
  }

  const x = (receipt.raw_parse ?? {}) as Extraction;
  const discountOf = (position: number, label: string) => {
    const it = x.items?.[position];
    return it && it.raw_label.trim() === label ? it.discount_cents : 0;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{receipt.store_name ?? "Ticket de caisse"}</h1>
        <p className="text-sm text-neutral-500">
          {[frDate(receipt.purchased_at), x.time].filter(Boolean).join(" à ") || "Date non lue"} · Total {euros(receipt.total_cents)}
        </p>
      </div>

      {x.needs_review && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Certains montants n&apos;ont pas pu être vérifiés (ticket coupé ou peu lisible). Vérifiez la liste avant de continuer.
        </div>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {(items ?? []).map((it) => {
          const discount = discountOf(it.position, it.raw_label);
          return (
            <li key={it.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="font-mono text-sm">
                {Number(it.quantity) > 1 && <span className="text-neutral-500">{Number(it.quantity)} × </span>}
                {it.raw_label}
              </span>
              <span className="shrink-0 text-right text-sm">
                {euros(it.total_price_cents)}
                {discount > 0 && <span className="block text-xs text-green-700">remise −{euros(discount)}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <Link href={`/receipts/${receipt.id}/select`} className="rounded-xl bg-black px-4 py-4 text-center text-lg font-medium text-white">
        Signaler un problème sur un produit
      </Link>
      <p className="text-center text-xs text-neutral-500">Uniquement pour un problème réel, constaté par vous.</p>
    </div>
  );
}
