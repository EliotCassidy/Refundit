// Brand registry ("cache" of known contact forms/emails). API_CONTRACTS §4.
// OWNERS: resolveBrand → Dev 1. getBrandContact + Linkup discovery (./discover.ts) → Dev 2.
import "server-only";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import type { BrandContact, BrandRow } from "@/lib/shared/types";
import { discoverBrandContact } from "./discover";

function toContact(b: BrandRow): BrandContact {
  return {
    brandId: b.id,
    name: b.name,
    contactUrl: b.contact_url,
    contactEmail: b.contact_email,
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

async function findBrand(input: { brandId: string } | { brandName: string }): Promise<BrandRow | null> {
  const db = createAdminClient();
  if ("brandId" in input) {
    const { data, error } = await db.from("brands").select("*").eq("id", input.brandId).maybeSingle();
    if (error) throw error;
    return data;
  }
  const name = input.brandName.trim();
  const { data, error } = await db.from("brands").select("*").ilike("name", name).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: byAlias } = await db.from("brands").select("*").contains("aliases", [name.toLowerCase()]).limit(1).maybeSingle();
  return byAlias;
}

/**
 * Returns how to reach the brand. Registry first; if the brand is unknown or has neither a
 * contact_url nor a contact_email and was never looked up, queries Linkup once and caches the
 * result in `brands` (source='linkup', verified=false). Never throws on Linkup errors.
 */
export async function getBrandContact(input: { brandId: string } | { brandName: string }): Promise<BrandContact> {
  const db = createAdminClient();
  const brand = await findBrand(input);

  if (brand && (brand.contact_url || brand.contact_email || brand.last_checked_at)) return toContact(brand);

  const name = brand?.name ?? ("brandName" in input ? input.brandName.trim() : "");
  if (!name) return { brandId: brand?.id ?? "", name, contactUrl: null, contactEmail: null, agentHints: null, requiresReceiptUpload: false, verified: false };

  let found: { contactUrl: string | null; contactEmail: string | null; sources: string[] } | null = null;
  try {
    found = await discoverBrandContact(name);
  } catch (err) {
    console.error("[linkup]", name, err);
  }
  if (!found || !process.env.LINKUP_API_KEY) {
    // No lookup possible: don't mark as checked, so it is retried once Linkup works.
    return brand ? toContact(brand) : { brandId: "", name, contactUrl: null, contactEmail: null, agentHints: null, requiresReceiptUpload: false, verified: false };
  }

  const fields = {
    contact_url: found.contactUrl,
    contact_email: found.contactEmail,
    last_checked_at: new Date().toISOString(),
  };
  const { data: saved, error } = brand
    ? await db.from("brands").update(fields).eq("id", brand.id).select("*").single()
    : await db
        .from("brands")
        .insert({ ...fields, name, aliases: [name.toLowerCase()], source: "linkup", verified: false })
        .select("*")
        .single();
  if (error) throw error;
  return toContact(saved);
}
