// OWNER: Dev 1. Brand registry ("cache" of known contact forms). API_CONTRACTS §4.
// Dev 2 calls getBrandContact() from /api/claims/:id/submit.
import "server-only";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import type { BrandContact, BrandRow } from "@/lib/shared/types";

function toContact(b: BrandRow): BrandContact {
  return {
    brandId: b.id,
    name: b.name,
    contactUrl: b.contact_url,
    agentHints: b.agent_hints,
    requiresReceiptUpload: b.requires_receipt_upload,
    verified: b.verified,
  };
}

/** Case-insensitive match on brand name and aliases. Registry only, no network call. */
export async function resolveBrand(label: string, brandGuess: string | null): Promise<{ brandId: string } | null> {
  const db = createAdminClient();
  const { data: brands, error } = await db.from("brands").select("id, name, aliases");
  if (error) throw error;

  const haystack = `${brandGuess ?? ""} ${label}`.toLowerCase();
  const match = brands.find(
    (b) => haystack.includes(b.name.toLowerCase()) || b.aliases.some((a) => a && haystack.includes(a.toLowerCase())),
  );
  return match ? { brandId: match.id } : null;
}

/**
 * Returns the registry entry for a brand.
 * TODO(dev1, P1): if the brand is unknown or has no contact_url, query Linkup for the brand's
 * French customer-service contact page, upsert a brands row (source='linkup', verified=false),
 * and return it. Check Linkup's official docs for the request/response shape first.
 */
export async function getBrandContact(input: { brandId: string } | { brandName: string }): Promise<BrandContact> {
  const db = createAdminClient();
  const query = db.from("brands").select("*");
  const { data, error } =
    "brandId" in input
      ? await query.eq("id", input.brandId).maybeSingle()
      : await query.ilike("name", input.brandName).maybeSingle();
  if (error) throw error;

  if (!data) {
    // Unknown brand and no Linkup yet → no contact URL → claim goes to needs_manual.
    return {
      brandId: "",
      name: "brandName" in input ? input.brandName : "",
      contactUrl: null,
      agentHints: null,
      requiresReceiptUpload: false,
      verified: false,
    };
  }
  return toContact(data);
}
