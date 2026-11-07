// Éval de l'étape 2 : le bon EAN est-il dans le top 5 ? Sur les tickets Open Prices, sans Linkup.
//   npm run eval:identify                     tous les tickets de tickets/openprices/
//   npm run eval:identify -- --only 143495    un ou quelques tickets
//   npm run eval:identify -- --linkup         AVEC le secours Linkup (payant, ~0,006 $ par ligne faible) : à demander d'abord
//   npm run eval:identify -- --linkup-cached  Linkup en relisant seulement les réponses déjà payées (aucun appel, gratuit)
//   npm run eval:identify -- --details        détail des lignes faibles : bon produit, réponses Linkup, où il s'est perdu
//
// 1. Les lignes viennent des transcriptions sauvées par eval:extract (.cache/eval/transcripts) : aucun appel d'extraction.
// 2. Chaque prix connu (<id>.known.json) est rattaché aux lignes de même montant (prix unitaire ou total, avant ou
//    après remise). Un prix sans ligne correspondante n'est pas évaluable.
// 3. On identifie ces lignes. Les prix de CE ticket sont exclus d'Open Prices, sinon le classement par prix triche.
// Coût : un appel LLM court par ligne, mis en cache (gratuit aux passages suivants). Open Food Facts / Prices : gratuits.
import { readFile, readdir } from "node:fs/promises";
import { identifyProduct, type IdentifyDebug } from "../products";
import { offDocument } from "../products/off";
import { WEB_REASON } from "../products/rank";
import type { ReceiptExtraction } from "../parse";
import { interpret } from "../interpret";

const args = process.argv.slice(2);
// Linkup est payant : JAMAIS en lot sans demande explicite (--linkup), quel que soit .env.local.
if (args.includes("--linkup-cached")) {
  process.env.LINKUP_PRODUCTS = "true";
  process.env.LINKUP_CACHE_ONLY = "true";
} else if (!args.includes("--linkup")) process.env.LINKUP_PRODUCTS = "false";
const DETAILS = args.includes("--details");
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
  // Calibration : pour chaque ligne évaluée, le score du 1er, l'écart avec le 2e, et si le 1er est le bon.
  const calib: { score: number; gap: number; uncertain: boolean; confident: boolean; ok: boolean }[] = [];
  // Linkup : lignes assez faibles pour l'appeler (= nombre d'appels payants), et bons produits qu'il a apportés.
  const web = { weak: 0, lines: 0, top1: 0, top5: 0 };

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
    const full = new Map<number, Awaited<ReturnType<typeof identifyProduct>> | null>();
    const pools = new Map<number, IdentifyDebug>();
    await pool(lines, CONCURRENCY, async (n) => {
      const it = x.items[n];
      const debug: IdentifyDebug = {};
      pools.set(n, debug);
      const r = await identifyProduct({
        rawLabel: it.raw_label,
        section: it.section,
        chain,
        unitPriceCents: Math.round(it.price_cents / it.qty),
        excludeProofId: known.proof_id,
        full: true, // l'éval ne lit jamais le cache par libellé (ni les choix manuels)
      }, debug).catch((err) => {
        console.error(`  [${id}] ${it.raw_label} : ${err}`);
        return null;
      });
      results.set(n, (r?.candidates ?? []).map((c) => eanKey(c.ean)));
      full.set(n, r);
    });

    for (const n of lines) {
      const r = full.get(n);
      web.lines++;
      if (pools.get(n)?.weak) web.weak++;
      const top = r?.candidates[0];
      if (!r || !top) continue;
      const truth = [...aligned].filter(([, ls]) => ls.includes(n)).map(([ean]) => eanKey(ean));
      calib.push({ score: top.score, gap: top.score - (r.candidates[1]?.score ?? 0), uncertain: r.uncertain, confident: r.confident, ok: truth.includes(eanKey(top.ean)) });
    }
    let top1 = 0, top5 = 0;
    for (const [ean, ls] of aligned) {
      const ranks = ls.map((n) => results.get(n)?.indexOf(eanKey(ean)) ?? -1).filter((r) => r >= 0);
      const viaLinkup = ls.map((n) => full.get(n)?.candidates.find((c) => eanKey(c.ean) === eanKey(ean))).find((c) => c?.source === "linkup" || c?.reasons.includes(WEB_REASON));
      if (viaLinkup) {
        web.top5++;
        if (ranks.includes(0)) web.top1++;
      }
      if (ranks.includes(0)) top1++;
      if (ranks.length) top5++;
      // Diagnostic des ratés : jamais trouvé par les recherches, trouvé mais pas dans la shortlist, ou mal classé
      if (!ranks.length) {
        const where = ls.some((n) => pools.get(n)?.shortlist?.includes(eanKey(ean))) ? "classé hors top 5"
          : ls.some((n) => pools.get(n)?.pool?.includes(eanKey(ean))) ? "trouvé, écarté avant le prix" : "jamais trouvé";
        misses[where] = (misses[where] ?? 0) + 1;
      }
    }
    // Détail des lignes faibles (celles où Linkup est appelé) : ce qu'il fallait trouver, et ce que Linkup a répondu.
    if (DETAILS) {
      for (const n of lines.filter((l) => pools.get(l)?.weak)) {
        const it = x.items[n];
        const d = pools.get(n)!;
        const r = full.get(n);
        for (const [ean, ls] of aligned) {
          if (!ls.includes(n)) continue;
          const want = eanKey(ean);
          const doc = await offDocument(ean).catch(() => null);
          const rankOf = r?.candidates.findIndex((c) => eanKey(c.ean) === want) ?? -1;
          const where = rankOf >= 0 ? `rang ${rankOf + 1}` : d.shortlist?.includes(want) ? "hors top 5" : d.pool?.includes(want) ? "écarté avant le prix" : "jamais trouvé";
          console.log(`    « ${it.raw_label} » ${(it.price_cents / 100).toFixed(2)} € → attendu ${doc ? `${doc.brand ?? "?"} | ${doc.name} | ${doc.quantity ?? "?"}` : `${ean} (absent d'OFF)`} : ${where}`);
          if (r?.candidates[0]) console.log(`        1er : ${r.candidates[0].brand ?? "?"} | ${r.candidates[0].name} (${r.candidates[0].score}, ${r.candidates[0].source})`);
          for (const w of d.web ?? []) {
            console.log(`        linkup : ${w.brand ?? "?"} | ${w.name}${w.ean ? ` [${w.ean}]` : ""} → ${w.hits.length} EAN${w.hits.includes(want) ? " (dont le bon)" : ""}`);
          }
          if (d.web && !d.web.length) console.log("        linkup : aucune réponse");
        }
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
  console.log(
    `Linkup : ${web.weak}/${web.lines} lignes assez faibles pour l'appeler (≈ ${(web.weak * 0.0055).toFixed(2)} $ si rien en cache)` +
      (process.env.LINKUP_PRODUCTS === "true" ? ` · bons produits apportés : ${web.top5} dans le top 5, dont ${web.top1} 1ers` : " · coupé pour ce passage"),
  );

  // Quelle règle donne un 1er juste à ≥ 90 % ? (pour valider automatiquement)
  console.log("\nCalibration (lignes où le 1er est le bon produit, selon son score et son écart avec le 2e) :");
  for (const minScore of [60, 70, 80, 90, 100]) {
    for (const minGap of [0, 5, 10, 20]) {
      const sel = calib.filter((c) => c.score >= minScore && c.gap >= minGap);
      const ok = sel.filter((c) => c.ok).length;
      if (sel.length) console.log(`  score ≥ ${String(minScore).padStart(3)} et écart ≥ ${String(minGap).padStart(2)} : ${String(ok).padStart(2)}/${String(sel.length).padEnd(2)} justes (${pct(ok, sel.length)}), ${pct(sel.length, calib.length)} des lignes`);
    }
  }
  const auto = calib.filter((c) => c.confident);
  console.log(`  validés automatiquement (confident, règle actuelle) : ${auto.filter((c) => c.ok).length}/${auto.length} justes (${pct(auto.filter((c) => c.ok).length, auto.length)})`);
  const sure = calib.filter((c) => !c.uncertain);
  console.log(`  « pas incertain » : ${sure.filter((c) => c.ok).length}/${sure.length} justes (${pct(sure.filter((c) => c.ok).length, sure.length)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
