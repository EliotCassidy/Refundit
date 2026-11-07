// OWNER: Dev 1. POST /api/receipts : upload + parse synchrone (API_CONTRACTS §5).
// multipart `image` → JPEG normalisé dans Storage → parse (lib/receipts/parse.ts) → receipts + line_items.
// Vercel refuse les corps > 4,5 Mo (413) : la page d'upload réduit la photo avant l'envoi.
import { getScanQuota } from "@/lib/billing";
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import type { Json } from "@/lib/shared/database.types";
import { prepareImage } from "@/lib/receipts/image";
import { parseReceipt } from "@/lib/receipts/parse";
import { resolveBrand } from "@/lib/brands";

// Extraction ~5-20 s + un retry possible ; chaque appel LLM est limité à 45 s (lib/shared/llm.ts).
export const maxDuration = 120;

const MAX_BYTES = 4.5 * 1024 * 1024;

// Comptes épargnés par le quota (comptes de démo/test) : emails séparés par des virgules.
// Ne jamais retirer le check lui-même : c'est la porte d'entrée du plan gratuit (lib/billing, Dev 2).
export function isQuotaExempt(email: string | null | undefined): boolean {
  const list = (process.env.SCAN_QUOTA_EXEMPT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return email != null && list.includes(email.toLowerCase());
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise");

  // Quota (API_CONTRACTS §5, billing) : 5 scans/mois (FREE_SCANS_PER_MONTH), avant tout upload.
  if (!isQuotaExempt(user.email)) {
    const quota = await getScanQuota(user.id);
    if (!quota.canScan) return apiError(402, "scan_limit_reached", "Tes scans gratuits du mois sont utilisés : passe à Refundit+ pour scanner sans limite.");
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) return apiError(400, "invalid_body", "Photo du ticket manquante (champ `image`)");
  if (file.size > MAX_BYTES) return apiError(413, "image_too_large", "Photo trop lourde (4,5 Mo max)");

  // HEIC/PNG/WebP/JPEG → JPEG redressé et réduit (c'est aussi ce fichier que l'agent joindra)
  let image;
  try {
    image = await prepareImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return apiError(400, "invalid_image", "Format d'image non reconnu (JPEG, PNG, WebP ou HEIC)");
  }

  const supabase = await createClient(); // client de l'utilisateur : RLS
  const receiptId = crypto.randomUUID();
  const imagePath = `${user.id}/${receiptId}.jpg`;

  const upload = await supabase.storage.from("receipts").upload(imagePath, image.buffer, { contentType: "image/jpeg" });
  if (upload.error) return apiError(500, "storage_error", upload.error.message);

  const created = await supabase
    .from("receipts")
    .insert({ id: receiptId, user_id: user.id, image_path: imagePath, status: "parsing" })
    .select("id")
    .single();
  if (created.error) return apiError(500, "db_error", created.error.message);

  // Parse. En cas d'échec, le ticket passe en 'failed' avec l'erreur (visible dans l'app).
  let result;
  try {
    result = await parseReceipt({ mediaType: image.mediaType, base64: image.base64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("receipts").update({ status: "failed", error: message }).eq("id", receiptId);
    return Response.json({ receiptId, status: "failed", items: [] }, { status: 201 });
  }
  const { parsed, extraction } = result;

  // Marque reconnue dans le registre à partir du libellé brut (aucune supposition du LLM).
  const brandIds = await Promise.all(parsed.items.map((it) => resolveBrand(it.raw_label, null)));

  const items = await supabase
    .from("line_items")
    .insert(
      parsed.items.map((it, i) => ({
        receipt_id: receiptId,
        user_id: user.id,
        position: i,
        raw_label: it.raw_label,
        product_name: it.product_name,
        brand_id: brandIds[i]?.brandId ?? null,
        brand_name_guess: it.brand_guess,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        total_price_cents: it.total_price_cents,
      })),
    )
    .select("*")
    .order("position");
  if (items.error) {
    await supabase.from("receipts").update({ status: "failed", error: items.error.message }).eq("id", receiptId);
    return apiError(500, "db_error", items.error.message);
  }

  const updated = await supabase
    .from("receipts")
    .update({
      status: "parsed",
      store_name: parsed.store_name,
      purchased_at: parsed.purchased_at,
      total_cents: parsed.total_cents,
      raw_parse: extraction as unknown as Json, // extraction complète : lignes, remises, checks, needs_review
    })
    .eq("id", receiptId);
  if (updated.error) return apiError(500, "db_error", updated.error.message);

  return Response.json({ receiptId, status: "parsed", items: items.data }, { status: 201 });
}
