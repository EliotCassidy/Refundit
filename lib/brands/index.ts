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

/** Texte comparable : minuscules, sans accents, ponctuation → espaces. */
const brandText = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ");

/**
 * Marque du registre lue dans le libellé (et/ou une marque supposée). Comparaison par mots, la correspondance la plus
 * longue gagne : « NOTCOCA » donne NotCoca, pas Coca-Cola (« coca » n'est pas au début d'un mot de « notcoca »).
 * - nom de marque : mot(s) entier(s) (« Lu » ne trouve pas « lucky ») ;
 * - alias : début de mot (« pringl » trouve « pringles ») ; un alias écrit avec une espace finale (« lu ») = mot entier.
 * Registre seulement, aucun appel réseau.
 */
export async function resolveBrand(label: string, brandGuess: string | null): Promise<{ brandId: string; name: string } | null> {
  const db = createAdminClient();
  const { data: brands, error } = await db.from("brands").select("id, name, aliases");
  if (error) throw error;

  const hay = ` ${brandText(`${brandGuess ?? ""} ${label}`).trim()} `;
  let best: { brandId: string; name: string; length: number } | null = null;
  for (const b of brands) {
    const options = [{ text: b.name, wholeWord: true }, ...b.aliases.map((a) => ({ text: a, wholeWord: a.endsWith(" ") }))];
    for (const o of options) {
      const t = brandText(o.text ?? "").trim();
      if (!t || !hay.includes(` ${t}${o.wholeWord ? " " : ""}`)) continue;
      if (!best || t.length > best.length) best = { brandId: b.id, name: b.name, length: t.length };
    }
  }
  return best ? { brandId: best.brandId, name: best.name } : null;
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

  if (!process.env.LINKUP_API_KEY) {
    // No lookup possible: don't mark as checked, so it runs once Linkup is configured.
    return brand ? toContact(brand) : { brandId: "", name, contactUrl: null, contactEmail: null, agentHints: null, requiresReceiptUpload: false, verified: false };
  }
  let found: { contactUrl: string | null; contactEmail: string | null; sources: string[] };
  try {
    found = await discoverBrandContact(name);
  } catch (err) {
    // Paid call: never retried automatically (CLAUDE.md rule 9). The brand is marked as checked
    // anyway; clear brands.last_checked_at by hand to look it up again.
    console.error("[linkup]", name, err);
    found = { contactUrl: null, contactEmail: null, sources: [] };
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
