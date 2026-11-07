// Prix de référence d'un EAN : médiane Open Prices chez l'enseigne, sinon partout.
// API vérifiée le 2026-11-07 : GET prices.openfoodfacts.org/api/v1/prices?product_code=…&size=…
// (chaque prix porte proof_id, currency, price, price_is_discounted, price_without_discount, location.osm_brand/osm_name).
import { getJson } from "./net";
import { normalize } from "../text";

type OpenPrice = {
  proof_id: number | null;
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

  const key = chain ? normalize(chain).split(" ")[0] : null; // "CARREFOUR MARKET" → "CARREFOUR"
  const atChain = key
    ? prices.filter((p) => normalize(`${p.location?.osm_brand ?? ""} ${p.location?.osm_name ?? ""}`).split(" ").includes(key))
    : [];
  if (atChain.length) return { cents: median(atChain.map(regular)), scope: "chain", n: atChain.length };
  if (prices.length) return { cents: median(prices.map(regular)), scope: "all", n: prices.length };
  return null;
}
