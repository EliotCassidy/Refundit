// Récupère des tickets de caisse français depuis Open Prices pour les évals.
//   npx tsx lib/receipts/eval/fetch-openprices.ts [--count 12] [--per-chain 2]
// Écrit tickets/openprices/<id>.jpg + <id>.known.json (EAN et prix saisis pour ce ticket).
// Licences : images CC BY-SA 4.0, données ODbL. Crédit : « Open Prices / Open Food Facts ».
// API vérifiée le 2026-11-07 sur prices.openfoodfacts.org/api/docs (schéma /api/schema).
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const API = "https://prices.openfoodfacts.org/api/v1";
const IMG = "https://prices.openfoodfacts.org/img";
const UA = "Refundit/0.1 (hackathon H Company x 42AI; +https://github.com/EliotCassidy/Refundit)";
const OUT = join(process.cwd(), "tickets", "openprices");

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const COUNT = arg("count", 12);
const PER_CHAIN = arg("per-chain", 2);
const MAX_PAGES = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Une requête par seconde maximum, quelques essais espacés sur 429 / 5xx / délai dépassé.
async function get(url: string): Promise<Response> {
  for (let i = 0; ; i++) {
    await sleep(1000);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
      if (i >= 3) throw new Error(`${res.status} ${url} (après ${i + 1} essais)`);
    } catch (err) {
      if (i >= 3 || !(err instanceof Error && (err.name === "TimeoutError" || err.message.startsWith("fetch failed")))) throw err;
    }
    await sleep(2000 * 2 ** i);
  }
}

type Proof = {
  id: number;
  file_path: string;
  mimetype: string;
  date: string | null;
  currency: string;
  price_count: number;
  receipt_price_count: number | null;
  receipt_price_total: number | null;
  location: { osm_brand: string | null; osm_name: string | null; osm_address_city: string | null; osm_address_country_code: string | null } | null;
};

type Price = {
  product_code: string | null;
  product_name: string | null;
  price: number;
  price_is_discounted: boolean;
  price_without_discount: number | null;
  discount_type: string | null;
  receipt_quantity: number | null;
  product: { product_name: string | null; brands: string | null; quantity: string | null; image_url: string | null } | null;
};

const exists = (p: string) => access(p).then(() => true, () => false);

async function main() {
  await mkdir(OUT, { recursive: true });
  const perChain = new Map<string, number>();
  const picked: Proof[] = [];

  // 1) choisir des tickets français, variés par enseigne
  for (let page = 1; page <= MAX_PAGES && picked.length < COUNT; page++) {
    const url = `${API}/proofs?type=RECEIPT&currency=EUR&price_count__gte=5&order_by=-created&size=100&page=${page}`;
    const { items } = (await (await get(url)).json()) as { items: Proof[] };
    if (!items.length) break;
    for (const p of items) {
      if (p.location?.osm_address_country_code !== "FR" || !p.file_path) continue;
      const chain = (p.location.osm_brand ?? p.location.osm_name ?? "?").toLowerCase();
      if ((perChain.get(chain) ?? 0) >= PER_CHAIN) continue;
      perChain.set(chain, (perChain.get(chain) ?? 0) + 1);
      picked.push(p);
      if (picked.length >= COUNT) break;
    }
    console.log(`page ${page} : ${picked.length}/${COUNT} tickets retenus`);
  }

  // 2) image + prix connus de chaque ticket
  for (const p of picked) {
    const ext = p.mimetype === "image/png" ? "png" : p.mimetype === "image/webp" ? "webp" : "jpg";
    const imgPath = join(OUT, `${p.id}.${ext}`);
    const knownPath = join(OUT, `${p.id}.known.json`);
    if (await exists(knownPath)) {
      console.log(`${p.id} déjà là`);
      continue;
    }
    await writeFile(imgPath, Buffer.from(await (await get(`${IMG}/${p.file_path}`)).arrayBuffer()));
    const { items: prices } = (await (await get(`${API}/prices?proof_id=${p.id}&size=100`)).json()) as { items: Price[] };

    // On ne garde pas le pseudo de l'auteur ni les champs inutiles.
    const known = {
      proof_id: p.id,
      source: `https://prices.openfoodfacts.org/proofs/${p.id}`,
      license: "image CC BY-SA 4.0, data ODbL — Open Prices / Open Food Facts",
      date: p.date,
      currency: p.currency,
      store: {
        chain: p.location?.osm_brand ?? null,
        name: p.location?.osm_name ?? null,
        city: p.location?.osm_address_city ?? null,
      },
      receipt_price_total: p.receipt_price_total,
      receipt_price_count: p.receipt_price_count,
      prices: prices.map((x) => ({
        ean: x.product_code,
        price: x.price,
        price_is_discounted: x.price_is_discounted,
        price_without_discount: x.price_without_discount,
        discount_type: x.discount_type,
        receipt_quantity: x.receipt_quantity,
        product_name: x.product?.product_name ?? x.product_name,
        brands: x.product?.brands ?? null,
        quantity: x.product?.quantity ?? null,
        image_url: x.product?.image_url ?? null,
      })),
    };
    await writeFile(knownPath, JSON.stringify(known, null, 2) + "\n");
    console.log(`${p.id} ${known.store.chain ?? known.store.name} ${p.date} : ${prices.length} prix`);
  }

  await writeFile(
    join(OUT, "CREDITS.md"),
    `# Crédits\n\nCes tickets et leurs prix viennent d'**Open Prices / Open Food Facts** (https://prices.openfoodfacts.org).\n\n` +
      `- Images : CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)\n` +
      `- Données (prix, EAN) : ODbL (https://opendatacommons.org/licenses/odbl/1-0/)\n\n` +
      `Chaque \`<id>.known.json\` renvoie à sa preuve d'origine (champ \`source\`).\n` +
      `Récupérés avec \`lib/receipts/eval/fetch-openprices.ts\`.\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
