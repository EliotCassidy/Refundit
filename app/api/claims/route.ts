// OWNER: Dev 1. POST /api/claims: create draft claims, then hand off to Dev 2's /submit.
// This is the integration seam (ARCHITECTURE.md §4.2).
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { CreateClaimsBodySchema } from "@/lib/shared/types";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Sign in required");

  const parsed = CreateClaimsBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.message);
  const { receiptId, items } = parsed.data;

  // RLS guarantees the user only sees their own line items.
  const supabase = await createClient();
  const { data: lineItems, error: liError } = await supabase
    .from("line_items")
    .select("id, brand_id, confirmed_product")
    .eq("receipt_id", receiptId)
    .in("id", items.map((i) => i.lineItemId));
  if (liError) return apiError(500, "db_error", liError.message);
  if (lineItems.length !== items.length) return apiError(400, "invalid_line_items", "Unknown line item(s)");

  // CLAUDE.md rule 8: every item needs a validated product (or an explicit "not_found") before a claim exists.
  if (lineItems.some((li) => li.confirmed_product === null)) {
    return apiError(400, "product_not_confirmed", "Choisissez le produit (ou « Je ne trouve pas mon produit ») pour chaque article.");
  }

  const brandByItem = new Map(lineItems.map((li) => [li.id, li.brand_id]));
  const { data: claims, error } = await supabase
    .from("claims")
    .insert(
      items.map((i) => ({
        user_id: user.id,
        receipt_id: receiptId,
        line_item_id: i.lineItemId,
        brand_id: brandByItem.get(i.lineItemId) ?? null,
        issue_type: i.issueType,
        issue_description: i.issueDescription ?? null,
        issue_photo_path: i.issuePhotoPath ?? null,
        status: "draft" as const,
      })),
    )
    .select("id");
  if (error) return apiError(500, "db_error", error.message);

  // Fire submit for each claim (Dev 2's endpoint). Failures leave the claim in 'draft'
  // and are visible on the claims page; we don't block the user on them.
  const origin = new URL(request.url).origin;
  await Promise.allSettled(
    claims.map((c) =>
      fetch(`${origin}/api/claims/${c.id}/submit`, {
        method: "POST",
        headers: { "x-internal-key": process.env.INTERNAL_API_KEY ?? "" },
      }),
    ),
  );

  return Response.json({ claimIds: claims.map((c) => c.id) }, { status: 201 });
}
