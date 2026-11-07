// OWNER: Dev 1. POST /api/receipts/:id/confirm : l'utilisateur valide un produit (API_CONTRACTS §5).
// { ean } doit être l'un des candidats proposés par /identify ; { ean: null } = « je ne trouve pas mon produit ».
// confirmed_product est le SEUL champ produit que l'agent lit (CLAUDE.md règle 8) ; on le recopie aussi dans
// ean / product_name / brand_name_guess / brand_id, et on alimente le cache partagé product_matches.
import { z } from "zod";
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import type { Json } from "@/lib/shared/database.types";
import { ProductCandidatesSchema, type ConfirmedProduct, type Product } from "@/lib/shared/types";
import type { ReceiptExtraction } from "@/lib/receipts/parse";
import { recordConfirmation } from "@/lib/receipts/products/matches";
import { resolveBrand } from "@/lib/brands";

const BodySchema = z.object({ lineItemId: z.uuid(), ean: z.string().nullable() });

export async function POST(request: Request, ctx: RouteContext<"/api/receipts/[id]/confirm">) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise");
  const { id } = await ctx.params;
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "invalid_body", body.error.message);

  const supabase = await createClient(); // RLS : uniquement les lignes de l'utilisateur
  const [{ data: item }, { data: receipt }] = await Promise.all([
    supabase
      .from("line_items")
      .select("id, raw_label, product_candidates")
      .eq("id", body.data.lineItemId)
      .eq("receipt_id", id)
      .maybeSingle(),
    supabase.from("receipts").select("store_name, raw_parse").eq("id", id).maybeSingle(),
  ]);
  if (!item || !receipt) return apiError(404, "not_found", "Article ou ticket introuvable");

  // « Je ne trouve pas mon produit » : la réclamation partira marquée « produit non identifié ».
  if (body.data.ean === null) {
    const confirmedProduct: ConfirmedProduct = { status: "not_found" };
    const brand = await resolveBrand(item.raw_label, null); // marque du registre lue dans le libellé, s'il y en a une
    const { error } = await supabase
      .from("line_items")
      .update({
        confirmed_product: confirmedProduct as unknown as Json,
        ean: null,
        product_name: item.raw_label,
        brand_name_guess: null,
        brand_id: brand?.brandId ?? null,
      })
      .eq("id", item.id);
    if (error) return apiError(500, "db_error", error.message);
    return Response.json({ lineItemId: item.id, confirmedProduct });
  }

  // Le produit choisi doit faire partie des candidats proposés (rien n'est inventé ni saisi à la main).
  const proposed = ProductCandidatesSchema.safeParse(item.product_candidates);
  const candidate = proposed.success ? proposed.data.candidates.find((c) => c.ean === body.data.ean) : undefined;
  if (!candidate) return apiError(400, "ean_not_proposed", "Ce produit ne fait pas partie des propositions");

  const product: Product = {
    ean: candidate.ean,
    brand: candidate.brand,
    name: candidate.name,
    quantity: candidate.quantity,
    image_url: candidate.image_url,
    source: candidate.source,
  };
  const confirmedProduct: ConfirmedProduct = { status: "confirmed", ...product };
  const brand = await resolveBrand(`${product.brand ?? ""} ${product.name}`, product.brand);
  const displayName = product.quantity && !product.name.includes(product.quantity) ? `${product.name} ${product.quantity}` : product.name;

  const { error } = await supabase
    .from("line_items")
    .update({
      confirmed_product: confirmedProduct as unknown as Json,
      ean: product.ean,
      product_name: displayName,
      brand_name_guess: product.brand,
      brand_id: brand?.brandId ?? null,
    })
    .eq("id", item.id);
  if (error) return apiError(500, "db_error", error.message);

  // Cache partagé (enseigne, libellé) → EAN. Un échec ici ne doit pas bloquer l'utilisateur.
  const x = receipt.raw_parse as unknown as Partial<ReceiptExtraction> | null;
  await recordConfirmation(x?.store?.chain ?? receipt.store_name, item.raw_label, product).catch((err) =>
    console.error("[product_matches]", err),
  );

  return Response.json({ lineItemId: item.id, confirmedProduct });
}
