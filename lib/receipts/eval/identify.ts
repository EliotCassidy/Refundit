// Éval de l'étape 2 : le bon EAN est-il dans le top 5 ? Sur les tickets Open Prices, sans Linkup.
//   npm run eval:identify                     tous les tickets de tickets/openprices/
//   npm run eval:identify -- --only 143495    un ou quelques tickets
//
// 1. Les lignes viennent des transcriptions sauvées par eval:extract (.cache/eval/transcripts) : aucun appel d'extraction.
// 2. Chaque prix connu (<id>.known.json) est rattaché aux lignes de même montant (prix unitaire ou total, avant ou
//    après remise). Un prix sans ligne correspondante n'est pas évaluable.
// 3. On identifie ces lignes. Les prix de CE ticket sont exclus d'Open Prices, sinon le classement par prix triche.
// Coût : un appel LLM court par ligne, mis en cache (gratuit aux passages suivants). Open Food Facts / Prices : gratuits.
import { readFile, readdir } from "node:fs/promises";
import { identifyProduct } from "../products";
import type { ReceiptExtraction } from "../parse";
import { interpret } from "../interpret";

const args = process.argv.slice(2);
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const CONCURRENCY = 3; // l'API H limite à 30 requêtes/min

type Known = {
  proof_id: number;
  store: { chain: string | null };
  prices: { ean: string | null; price: number; price_without_discount: number | null; receipt_quantity: number | null }[];
};

const eanKey = (ean: string) => ean.replace(/^0+/, "");
const cents = (euros: number) => Math.round(euros * 100);

/** Montants possibles d'une ligne pour ce prix connu : unitaire ou total, avant ou après remise. */
function amounts(p: Known["prices"][number]): Set<number> {
  const qty = p.receipt_quantity || 1;
  const units = [p.price, p.price_without_discount ?? p.price];
  return new Set(units.flatMap((u) => [cents(u), cents(u * qty)]));
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1).padStart(5)} %` : "    -");

async function main() {
  const ids = (await readdir("tickets/openprices")).filter((f) => f.endsWith(".known.json")).map((f) => f.split(".")[0]);
  const total = { known: 0, aligned: 0, top1: 0, top5: 0 };
  const misses: Record<string, number> = {};

  for (const id of ids.filter((i) => !ONLY || ONLY.includes(i))) {
    const known = JSON.parse(await readFile(`tickets/openprices/${id}.known.json`, "utf8")) as Known;
    let x: ReceiptExtraction;
    try {
      const saved = JSON.parse(await readFile(`.cache/eval/transcripts/${id}.json`, "utf8")) as ReceiptExtraction;
      // On ré-interprète la transcription avec le code actuel (gratuit) : les corrections d'interprétation comptent.
      x = { ...saved, ...interpret({ store: saved.store, date_raw: saved.date_raw, time_raw: saved.time_raw, lines: saved.lines }) };
    } catch {
      console.log(`${id} : pas de transcription sauvée (lancer d'abord npm run eval:extract)`);
      continue;
    }

    // Alignement : EAN connu → lignes du ticket de même montant
    const aligned = new Map<string, number[]>();
    for (const p of known.prices) {
      if (!p.ean) continue;
      const want = amounts(p);
      const lines = x.items.flatMap((it, n) => (want.has(it.price_cents) || want.has(it.paid_cents) ? [n] : []));
      if (lines.length) aligned.set(p.ean, lines);
    }
    const lines = [...new Set([...aligned.values()].flat())];
    const chain = x.store.chain ?? known.store.chain;

    const t0 = Date.now();
    const results = new Map<number, string[]>();
    const pools = new Map<number, { pool?: string[]; shortlist?: string[] }>();
    await pool(lines, CONCURRENCY, async (n) => {
      const it = x.items[n];
      const debug: { pool?: string[]; shortlist?: string[] } = {};
      pools.set(n, debug);
      const r = await identifyProduct({
        rawLabel: it.raw_label,
        section: it.section,
        chain,
        unitPriceCents: Math.round(it.price_cents / it.qty),
        excludeProofId: known.proof_id,
      }, debug).catch((err) => {
        console.error(`  [${id}] ${it.raw_label} : ${err}`);
        return null;
      });
      results.set(n, (r?.candidates ?? []).map((c) => eanKey(c.ean)));
    });

    let top1 = 0, top5 = 0;
    for (const [ean, ls] of aligned) {
      const ranks = ls.map((n) => results.get(n)?.indexOf(eanKey(ean)) ?? -1).filter((r) => r >= 0);
      if (ranks.includes(0)) top1++;
      if (ranks.length) top5++;
      // Diagnostic des ratés : jamais trouvé par les recherches, trouvé mais pas dans la shortlist, ou mal classé
      if (!ranks.length) {
        const where = ls.some((n) => pools.get(n)?.shortlist?.includes(eanKey(ean))) ? "classé hors top 5"
          : ls.some((n) => pools.get(n)?.pool?.includes(eanKey(ean))) ? "trouvé, écarté avant le prix" : "jamais trouvé";
        misses[where] = (misses[where] ?? 0) + 1;
      }
    }
    total.known += known.prices.length;
    total.aligned += aligned.size;
    total.top1 += top1;
    total.top5 += top5;
    console.log(
      `${id.padStart(7)} ${(chain ?? "?").slice(0, 16).padEnd(16)} connus ${String(known.prices.length).padStart(3)}` +
        `  alignés ${String(aligned.size).padStart(3)}  top1 ${String(top1).padStart(3)}  top5 ${String(top5).padStart(3)}` +
        ` (${pct(top5, aligned.size)})  ${Math.round((Date.now() - t0) / 1000)} s`,
    );
  }

  console.log(
    `\nTOTAL : top 1 = ${pct(total.top1, total.aligned)}, top 5 = ${pct(total.top5, total.aligned)} des ${total.aligned} EAN alignés` +
      ` (${pct(total.top5, total.known)} de tous les EAN connus)`,
  );
  console.log(`Ratés : ${Object.entries(misses).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
