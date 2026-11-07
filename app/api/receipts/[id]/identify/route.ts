// OWNER: Dev 1. POST /api/receipts/:id/identify : un article coché → top 5 des vrais produits (API_CONTRACTS §5).
// UN article par appel : la page les lance en parallèle, chaque appel tient dans maxDuration.
// Secours quand le produit n'est pas proposé : { ean } (code-barres saisi ou scanné) ou { query } (nom tapé).
import { z } from "zod";
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import type { Json } from "@/lib/shared/database.types";
import type { ReceiptExtraction } from "@/lib/receipts/parse";
import { identifyProduct } from "@/lib/receipts/products";
import { isValidEan } from "@/lib/receipts/products/ean";
import { obfProduct, offDocument } from "@/lib/receipts/products/off";
import type { ProductCandidates } from "@/lib/shared/types";

// 1 appel LLM court + 2 à 4 recherches + jusqu'à 6 prix Open Prices (débit limité) ≈ 2-15 s
export const maxDuration = 60;

const BodySchema = z.object({
  lineItemId: z.uuid(),
  ean: z.string().trim().regex(/^\d{8,14}$/).optional(), // code-barres saisi ou scanné par l'utilisateur
  query: z.string().trim().min(2).max(100).optional(), // nom du produit tapé par l'utilisateur
});

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

  let productCandidates: ProductCandidates;
  if (body.data.ean) {
    // Code-barres : la fiche exacte du produit, sans deviner.
    const ean = body.data.ean;
    if (!isValidEan(ean)) return apiError(400, "invalid_ean", "Code-barres invalide : vérifiez les chiffres.");
    const hit = (await offDocument(ean).catch(() => null)) ?? (await obfProduct(ean).catch(() => null));
    if (!hit) return apiError(404, "ean_unknown", "Ce code-barres n'est pas dans Open Food Facts. Essayez avec le nom du produit.");
    productCandidates = {
      llm_guess: null,
      candidates: [{ ...hit, score: 100, reference_price_cents: null, reasons: ["code-barres saisi par vous"] }],
      uncertain: false,
      uncertain_reasons: [],
      searched_at: new Date().toISOString(),
    };
  } else {
    productCandidates = await identifyProduct({
      rawLabel: item.raw_label,
      section: same ? extracted!.section : null,
      chain: x?.store?.chain ?? receipt.store_name,
      unitPriceCents,
      userQuery: body.data.query,
    });
  }

  const { error } = await supabase
    .from("line_items")
    .update({ product_candidates: productCandidates as unknown as Json })
    .eq("id", item.id);
  if (error) return apiError(500, "db_error", error.message);

  return Response.json({ lineItemId: item.id, productCandidates });
}
