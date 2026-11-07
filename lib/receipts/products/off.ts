// Candidats depuis Open Food Facts (Search-a-licious) et Open Beauty Facts (hygiène / beauté).
// API vérifiées le 2026-11-07 :
// - search.openfoodfacts.org/search : q en syntaxe Lucene (ex. brands:"carrefour" ravioli), langs, page_size, fields.
//   Seul l'index 'off' existe (pas d'OBF).
// - world.openbeautyfacts.org/cgi/search.pl : search_terms (plein texte), json=1, page_size, fields.
import type { Product } from "@/lib/shared/types";
import { getJson } from "./net";
import { isValidEan, type Size } from "./ean";

export type Hit = Omit<Product, "source"> & { source: "off" | "obf" };

const FIELDS = "code,product_name,product_name_fr,brands,quantity,image_front_small_url,image_front_url";

type OffDoc = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string | string[];
  quantity?: string | null;
  image_front_small_url?: string | null;
  image_front_url?: string | null;
};

function toHit(d: OffDoc, source: Hit["source"]): Hit | null {
  const name = (d.product_name_fr || d.product_name || "").trim();
  if (!isValidEan(d.code) || !name) return null; // un EAN n'est accepté que si sa clé de contrôle est valide
  const brands = Array.isArray(d.brands) ? d.brands : (d.brands ?? "").split(",");
  return {
    ean: d.code,
    name,
    brand: brands.map((b) => b.trim()).filter(Boolean)[0] ?? null,
    quantity: d.quantity?.trim() || null,
    image_url: d.image_front_url || d.image_front_small_url || null,
    source,
  };
}

const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

/** Écritures courantes d'un format dans le champ quantity d'OFF : 1750 ml → "1,75 l", "1.75l", "175 cl"… */
export function quantityVariants(size: Size): string[] {
  const n = (x: number) => String(Math.round(x * 1000) / 1000);
  const both = (v: string, unit: string) => [`${v} ${unit}`, `${v}${unit}`, `${v.replace(".", ",")} ${unit}`, `${v.replace(".", ",")}${unit}`];
  if (size.unit === "ml") return [...new Set([...both(n(size.total / 1000), "l"), ...both(n(size.total / 10), "cl"), ...both(n(size.total), "ml")])];
  if (size.unit === "g") return [...new Set([...both(n(size.total), "g"), ...(size.total >= 1000 ? both(n(size.total / 1000), "kg") : [])])];
  return [];
}

/**
 * Recherche Open Food Facts, filtrée sur une marque et/ou un format (champ quantity, syntaxe Lucene)
 * s'ils sont donnés. Le filtre de format aide quand le texte seul ramène trop de variantes (Coca 33 cl, 2 l, light…).
 */
export async function searchOff(text: string, brand?: string | null, quantities: string[] = []): Promise<Hit[]> {
  const sizeFilter = quantities.length ? `(${quantities.map((v) => `quantity:${quote(v)}`).join(" OR ")}) ` : "";
  const q = `${brand ? `brands:${quote(brand)} ` : ""}${sizeFilter}${text}`.trim();
  const url = `https://search.openfoodfacts.org/search?${new URLSearchParams({ q, langs: "fr", page_size: "20", fields: FIELDS })}`;
  const res = await getJson<{ hits?: OffDoc[] }>(url);
  return (res?.hits ?? []).map((d) => toHit(d, "off")).filter((h): h is Hit => h !== null);
}

/** Recherche plein texte Open Beauty Facts. */
export async function searchObf(text: string): Promise<Hit[]> {
  const url = `https://world.openbeautyfacts.org/cgi/search.pl?${new URLSearchParams({ search_terms: text, search_simple: "1", json: "1", page_size: "20", fields: FIELDS })}`;
  const res = await getJson<{ products?: OffDoc[] }>(url);
  return (res?.products ?? []).map((d) => toHit(d, "obf")).filter((h): h is Hit => h !== null);
}
