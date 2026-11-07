// OWNER: Dev 1. POST /api/receipts/:id/identify : un article coché → top 5 des vrais produits (API_CONTRACTS §5).
// UN article par appel : la page les lance en parallèle, chaque appel tient dans maxDuration.
import { z } from "zod";
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import type { Json } from "@/lib/shared/database.types";
import type { ReceiptExtraction } from "@/lib/receipts/parse";
import { identifyProduct } from "@/lib/receipts/products";

// 1 appel LLM court + 2 à 4 recherches + jusqu'à 6 prix Open Prices (débit limité) ≈ 2-15 s
export const maxDuration = 60;

const BodySchema = z.object({ lineItemId: z.uuid() });

export async function POST(request: Request, ctx: RouteContext<"/api/receipts/[id]/identify">) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise");
  const { id } = await ctx.params;
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_body", body.error.message);

  const supabase = await createClient(); // RLS : uniquement les lignes de l'utilisateur
  const [{ data: item }, { data: receipt }] = await Promise.all([
    supabase
      .from("line_items")
      .select("id, position, raw_label, quantity, unit_price_cents, total_price_cents")
      .eq("id", body.data.lineItemId)
      .eq("receipt_id", id)
      .maybeSingle(),
    supabase.from("receipts").select("store_name, raw_parse").eq("id", id).maybeSingle(),
  ]);
  if (!item || !receipt) return apiError(404, "not_found", "Article ou ticket introuvable");

  // Rayon, enseigne et prix avant remise viennent de l'extraction complète (raw_parse), si elle correspond.
  const x = receipt.raw_parse as unknown as Partial<ReceiptExtraction> | null;
  const extracted = x?.items?.[item.position];
  const same = extracted?.raw_label.trim() === item.raw_label;
  const unitPriceCents = same
    ? Math.round(extracted!.price_cents / extracted!.qty)
    : (item.unit_price_cents ?? Math.round(item.total_price_cents / Number(item.quantity)));

  const productCandidates = await identifyProduct({
    rawLabel: item.raw_label,
    section: same ? extracted!.section : null,
    chain: x?.store?.chain ?? receipt.store_name,
    unitPriceCents,
  });

  const { error } = await supabase
    .from("line_items")
    .update({ product_candidates: productCandidates as unknown as Json })
    .eq("id", item.id);
  if (error) return apiError(500, "db_error", error.message);

  return Response.json({ lineItemId: item.id, productCandidates });
}
