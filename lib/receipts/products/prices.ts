// Prix de référence d'un EAN : médiane Open Prices chez l'enseigne, sinon partout.
// API vérifiée le 2026-11-07 : GET prices.openfoodfacts.org/api/v1/prices?product_code=…&size=…
// (chaque prix porte proof_id, currency, price, price_is_discounted, price_without_discount, location.osm_brand/osm_name).
import type { Product } from "@/lib/shared/types";
import { getJson } from "./net";
import { isValidEan } from "./ean";
import { normalize } from "../text";

type OpenPrice = {
  proof_id: number | null;
  product_code?: string | null;
  product?: { product_name: string | null; brands: string | null; quantity: string | null; image_url: string | null } | null;
  currency: string;
  price: number;
  price_is_discounted: boolean;
  price_without_discount: number | null;
  price_per: string | null;
  location: { osm_brand: string | null; osm_name: string | null } | null;
};

export type ReferencePrice = { cents: number; scope: "chain" | "all"; n: number } | null;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * @param excludeProofId prix d'un ticket à ignorer (l'éval exclut le ticket évalué, sinon le classement par prix triche)
 */
export async function referencePrice(ean: string, chain: string | null, excludeProofId?: number): Promise<ReferencePrice> {
  const res = await getJson<{ items?: OpenPrice[] }>(
    `https://prices.openfoodfacts.org/api/v1/prices?${new URLSearchParams({ product_code: ean, size: "100", order_by: "-date" })}`,
  );
  // Prix normal (hors promo), en euros, à l'unité (pas au kilo)
  const prices = (res?.items ?? []).filter((p) => p.currency === "EUR" && !p.price_per && p.proof_id !== excludeProofId);
  const regular = (p: OpenPrice) => Math.round(100 * (p.price_is_discounted && p.price_without_discount ? p.price_without_discount : p.price));

  const key = chainKeyword(chain); // "CARREFOUR MARKET" → "CARREFOUR", "E.LECLERC" → "LECLERC"
  const atChain = key
    ? prices.filter((p) => normalize(`${p.location?.osm_brand ?? ""} ${p.location?.osm_name ?? ""}`).split(" ").includes(key))
    : [];
  if (atChain.length) return { cents: median(atChain.map(regular)), scope: "chain", n: atChain.length };
  if (prices.length) return { cents: median(prices.map(regular)), scope: "all", n: prices.length };
  return null;
}

/** Mot qui désigne l'enseigne : le plus long du nom imprimé ("E.Leclerc" → "LECLERC", "Super U" → "SUPER"). */
function chainKeyword(chain: string | null): string | null {
  const words = normalize(chain ?? "").split(" ").filter(Boolean);
  return words.length ? words.reduce((a, b) => (b.length > a.length ? b : a)) : null;
}

/**
 * Produits relevés sur Open Prices AU MÊME PRIX dans des magasins de la même enseigne : un indice fort que la
 * recherche par mots n'exploite pas (ex. la pizza du ticket Carrefour 143495). Gratuit.
 * API vérifiée le 2026-11-07 : location__osm_name__contains sur /prices renvoie toujours 0 → on passe par
 * /locations?osm_name__like=… (les 100 magasins les plus fournis) puis /prices?location_id__in=….
 */
export async function samePriceAtChain(
  chain: string | null,
  priceCents: number | null,
  excludeProofId?: number,
): Promise<(Omit<Product, "source"> & { seen: number })[]> {
  const key = chainKeyword(chain);
  if (!key || !priceCents) return [];
  const locations = await getJson<{ items?: { id: number }[] }>(
    `https://prices.openfoodfacts.org/api/v1/locations?${new URLSearchParams({
      osm_name__like: chain!, osm_address_country__like: "France", price_count__gte: "1", order_by: "-price_count", size: "100",
    })}`,
  );
  const ids = (locations?.items ?? []).map((l) => l.id);
  if (!ids.length) return [];
  const res = await getJson<{ items?: OpenPrice[] }>(
    `https://prices.openfoodfacts.org/api/v1/prices?${new URLSearchParams({
      price: (priceCents / 100).toFixed(2), currency: "EUR", location_id__in: ids.join(","), size: "100", order_by: "-date",
    })}`,
  );
  const out = new Map<string, Omit<Product, "source"> & { seen: number }>();
  for (const p of res?.items ?? []) {
    const ean = p.product_code ?? "";
    const name = p.product?.product_name?.trim();
    if (p.proof_id === excludeProofId || !isValidEan(ean) || !name) continue;
    if (out.has(ean)) {
      out.get(ean)!.seen++;
      continue;
    }
    out.set(ean, {
      seen: 1,
      ean, name,
      brand: p.product?.brands?.split(",")[0]?.trim() || null,
      quantity: p.product?.quantity?.trim() || null,
      image_url: p.product?.image_url ?? null,
    });
  }
  return [...out.values()];
}
