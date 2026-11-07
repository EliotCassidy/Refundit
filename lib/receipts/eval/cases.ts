// Cas de test de l'extraction (interpret, checks) et de l'identification (EAN, formats, classement),
// sans réseau ni modèle : npm run test:receipts
import { interpret, parseDate, parseTime, toPurchasedAt, parseCents, type Transcription } from "../interpret";
import { runChecks } from "../checks";
import { isValidEan, parseSizes, sizesMatch } from "../products/ean";
import { rank, privateLabel, brandConflict, WEB_REASON, type Candidate } from "../products/rank";
import { quantityVariants } from "../products/off";
import { getJson, isEmptyResult, isFresh } from "../products/net";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
}
const L = (text: string, amount: string | null = null, extra: Partial<Transcription["lines"][number]> = {}) => ({ text, amount, ...extra });
const T = (lines: Transcription["lines"], date_raw = "17/12/25", time_raw = "13:55"): Transcription => ({ store: { chain: "CARREFOUR", name: null }, date_raw, time_raw, lines });

// --- nombres, dates, heures
eq("cents 1,99", parseCents("1,99"), 199);
eq("cents -0,50", parseCents("-0,50"), -50);
eq("cents 0,50-", parseCents("0,50-"), -50);
eq("cents 12 €", parseCents("12 €"), 1200);
eq("cents 3.5", parseCents(3.5), 350);
eq("cents illisible", parseCents("abc"), null);
eq("date 17/12/25", parseDate("17/12/25"), "2025-12-17");
eq("date 17.12.2025", parseDate("17.12.2025"), "2025-12-17");
eq("date 17-12-2025 13:55", parseDate("17-12-2025 13:55"), "2025-12-17");
eq("date 17 décembre 2025", parseDate("Mercredi 17 décembre 2025"), "2025-12-17");
eq("date 14 Mar. 2026", parseDate("14 Mar. 2026"), "2026-03-14");
eq("date 1er juin 2026", parseDate("1er juin 2026"), "2026-06-01");
eq("date 3 juil 26", parseDate("3 juil 26"), "2026-07-03");
eq("date ISO", parseDate("2026-03-14"), "2026-03-14");
eq("date invalide 31/02/25", parseDate("31/02/25"), null);
eq("heure 13h55", parseTime("13h55"), "13:55");
eq("heure 9:05", parseTime("le 17/12 à 9:05"), "09:05");
eq("purchased_at hiver", toPurchasedAt("2025-12-17", "13:55"), "2025-12-17T13:55:00+01:00");
eq("purchased_at été", toPurchasedAt("2026-07-03", null), "2026-07-03T12:00:00+02:00");

// --- 1. remises sous l'article + totaux complets
{
  const r = interpret(T([
    L("PRINGLES ORIG 175G", "2,00", { section: "EPICERIE", mark: "T" }),
    L("34% de reduction", "-0,68"),
    L("EVIAN 6X1,5L", "3,10", { section: "LIQUIDES" }),
    L("SOUS-TOTAL", "5,10"),
    L("TOTAL REMISES", "0,68"),
    L("NET A PAYER", "4,42"),
    L("NB ARTICLES : 2"),
    L("CB SANS CONTACT", "4,42"),
  ]));
  const c = runChecks(r);
  eq("1 articles", r.items.map((i) => [i.raw_label, i.price_cents, i.discount_cents, i.discount_pct, i.paid_cents, i.section, i.mark]),
    [["PRINGLES ORIG 175G", 200, 68, 34, 132, "EPICERIE", "T"], ["EVIAN 6X1,5L", 310, 0, null, 310, "LIQUIDES", null]]);
  eq("1 totaux imprimés", r.printed, { gross_cents: 510, discounts_cents: 68, paid_cents: 442, n_items: 2, n_lines: null });
  eq("1 checks", [c.errors, c.skipped, c.needs_review], [[], ["n_lines"], false]);
}

// --- 2. récap Monop' après le total (ne doit pas compter deux fois)
{
  const r = interpret(T([
    L("PRINGLES ORIG", "2,00"),
    L("REMISE 34%", "-0,68"),
    L("EVIAN", "3,10"),
    L("TOTAL", "4,42"),
    L("Rappel remises articles"),
    L("PRINGLES ORIG 34%", "-0,68"),
    L("CB", "4,42"),
  ]));
  const c = runChecks(r);
  eq("2 mode récap", r.tail_mode, "recap");
  eq("2 remises", r.items.map((i) => i.discount_cents), [68, 0]);
  eq("2 checks", [c.errors, c.skipped, c.needs_review], [[], ["gross_cents", "discounts_cents", "n_items", "n_lines"], false]);
}

// --- 3. vraies remises regroupées en fin de ticket, rattachement net
{
  const r = interpret(T([
    L("PRINGLES ORIG 175G", "2,50"),
    L("EVIAN 6X1,5L", "3,10"),
    L("LU PRINCE CHOCO", "1,90"),
    L("SOUS TOTAL", "7,50"),
    L("REM PRINGLES", "-1,00"),
    L("REMISE EVIAN 6X1,5L", "-0,50"),
    L("TOTAL A PAYER", "6,00"),
  ]));
  const c = runChecks(r);
  eq("3 mode appliqué", r.tail_mode, "applied");
  eq("3 rattachement", r.items.map((i) => i.discount_cents), [100, 50, 0]);
  eq("3 globales", r.global_discounts, []);
  eq("3 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 4. remise ambiguë (deux articles ressemblent autant) → globale
{
  const r = interpret(T([
    L("PRINGLES ORIG 175G", "2,50"),
    L("PRINGLES PAPRIKA 175G", "2,50"),
    L("TOTAL", "5,00"),
    L("REM PRINGLES", "-1,00"),
    L("NET A PAYER", "4,00"),
  ]));
  const c = runChecks(r);
  eq("4 mode", r.tail_mode, "applied");
  eq("4 globale", r.global_discounts, [{ text: "REM PRINGLES", amount_cents: 100 }]);
  eq("4 TOTAL seul = brut quand NET A PAYER existe", r.printed.gross_cents, 500);
  eq("4 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 5. aucun total imprimé → tout sauté, relecture
{
  const r = interpret(T([L("PAIN", "1,20"), L("BEURRE", "2,30")], "17/12/25", ""));
  const c = runChecks(r);
  eq("5 checks", [c.errors, c.skipped.length, c.needs_review], [[], 5, true]);
}

// --- 6. payé absent mais d'autres totaux présents → relecture quand même
{
  const r = interpret(T([L("PAIN", "1,20"), L("BEURRE", "2,30"), L("SOUS TOTAL", "3,50")]));
  const c = runChecks(r);
  eq("6 payé absent", [c.errors, c.skipped, c.needs_review], [[], ["discounts_cents", "paid_cents", "n_items", "n_lines"], true]);
}

// --- 7. lignes de quantité et articles pesés
{
  const r = interpret(T([
    L("COCA COLA 33CL", "3,98"),
    L("2 x 1,99"),
    L("YAOURT NATURE"),
    L("3 x 0,50", "1,50"),
    L("TOMATES GRAPPE", "1,29"),
    L("0,430 kg x 3,00 €/kg"),
    L("TOTAL", "6,77"),
    L("NB ART 6"),
  ]));
  const c = runChecks(r);
  eq("7 articles", r.items.map((i) => [i.raw_label, i.qty, i.unit_price_cents, i.price_cents, i.weight_kg]),
    [["COCA COLA 33CL", 2, 199, 398, null], ["YAOURT NATURE", 3, 50, 150, null], ["TOMATES GRAPPE", 1, 300, 129, 0.43]]);
  eq("7 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 8. remise en % sous le mauvais article → erreur explicite
{
  const r = interpret(T([
    L("PRINGLES ORIG", "2,00"),
    L("EVIAN", "5,00"),
    L("34% de reduction", "-0,68"),
    L("TOTAL", "6,32"),
  ]));
  const c = runChecks(r);
  eq("8 une erreur", c.errors.length, 1);
  console.log("     →", c.errors[0]);
}

// --- 9. paiement en espèces seulement (pas de ligne TOTAL) → payé = espèces − rendu
{
  const r = interpret(T([L("PAIN", "1,20"), L("SOUS-TOTAL", "1,20"), L("ESPECES", "5,00"), L("RENDU MONNAIE", "3,80")]));
  eq("9 payé via paiements", [r.printed.paid_cents, r.paid_source], [120, "payments"]);
}

// --- 10. Carrefour Market (ticket Open Prices 143495) : nombre d'articles et total sur la même ligne
{
  const r = interpret(T([
    L("*1L BOISSON SOJA NA", "1.98€", { mark: "6" }),
    L("2 x 0.99€"),
    L("REMISE", "-0.20€"),
    L("*360G PIZZA BUCHE C", "3.59€", { mark: "6" }),
    L("*650G RAVIOLI VEGET", "3.45€", { mark: "6" }),
    L("*8X100G FRO BLC NAT", "1.38€", { mark: "6" }),
    L("*90G NOIX BIO CARRE", "2.45€", { mark: "6" }),
    L("TOTAL ALIMENTAIRE", "12.65€"),
    L("6 ARTICLE(S) TOTAL AVANT REMISES", "12.85€"),
    L("TOTAL REMISES IMMEDIATES", "-0.20€"),
    L("TOTAL DES AVANTAGES DU JOUR", "-0.20€"),
    L("6 ARTICLE(S) TOTAL A PAYER", "12.65€"),
    L("CB EMV SANS CONTACT EUR", "12.65€"),
  ], "03/11/2026", "16:50:21"));
  const c = runChecks(r);
  eq("10 totaux imprimés", r.printed, { gross_cents: 1285, discounts_cents: 20, paid_cents: 1265, n_items: 6, n_lines: null });
  eq("10 payé via total", r.paid_source, "total");
  eq("10 soja", [r.items[0].qty, r.items[0].unit_price_cents, r.items[0].paid_cents], [2, 99, 178]);
  eq("10 checks", [c.errors, c.skipped, c.needs_review], [[], ["n_lines"], false]);
}


// --- 11. Aldi : code TVA derrière le montant, "Nombre de lignes d'articles"
{
  eq("11 cents 4,17 € 1", parseCents("4,17 € 1"), 417);
  eq("11 cents 8,99 € 11", parseCents("8,99 € 11"), 899);
  const r = interpret(T([
    L("RIZ CAMARGUE IGP 500 G", "4,17 € 1"),
    L("BATON.DUATESX300 COTONBI", "1,98 € 2", { qty: "3 x" }),
    L("Nombre de lignes d'articles 2"),
    L("A PAYER", "6,15 €"),
    L("TOTAL HT", "5,80 €"),
    L("TOTAL TVA", "0,35 €"),
    L("CB", "6,15 €"),
  ]));
  const c = runChecks(r);
  eq("11 articles", r.items.map((i) => [i.price_cents, i.qty]), [[417, 1], [198, 3]]);
  eq("11 lignes vs unités", [r.printed.n_lines, r.printed.n_items], [2, null]);
  eq("11 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 12. Super U : "1 x" seul + prix unitaire, SOUS-TOTAL hors taxes, "TOTAL [34] Articles"
{
  const r = interpret(T([
    L("B/BLD GRIMBERGEN 12X25CL", "8,99 €"),
    L("1 x", "8,99 EUR", { qty: "1 x" }),
    L("CREMANT BOURG 75CL", "15,90 €", { qty: "2 x" }),
    L("2 x", "7,95 EUR", { qty: "2 x" }),
    L("Nombre de lignes d'articles 2"),
    L("TOTAL [3] Articles", "24,89 €"),
    L("SOUS-TOTAL", "20,74 €"),
    L("TOTAL TVA", "4,15 €"),
  ]));
  const c = runChecks(r);
  eq("12 pas de faux article", r.items.map((i) => [i.raw_label, i.qty, i.unit_price_cents, i.price_cents]),
    [["B/BLD GRIMBERGEN 12X25CL", 1, 899, 899], ["CREMANT BOURG 75CL", 2, 795, 1590]]);
  eq("12 totaux", r.printed, { gross_cents: null, discounts_cents: null, paid_cents: 2489, n_items: 3, n_lines: 2 });
  eq("12 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 13. Auchan : quantité en colonne + prix unitaire (tranché par le total payé)
{
  const r = interpret(T([
    L("SAUPIQ THON ENTIER..", "6,79"),
    L("LES COMPAGNONS DU ..", "7,53", { qty: "2" }),
    L("MIEL CREMEUX DE F..", "-5,12"),
    L("TOTAL REMISES", "-5,12"),
    L("Total", "16,73 €"),
  ]));
  const c = runChecks(r);
  eq("13 miel", [r.items[1].qty, r.items[1].unit_price_cents, r.items[1].price_cents, r.items[1].paid_cents], [2, 753, 1506, 994]);
  eq("13 checks", [c.errors, c.needs_review], [[], false]);
}

// --- 14. Monoprix : "TOTAL HORS PROMOTION", "2e a -40%" sur une unité
{
  const r = interpret(T([
    L("2 X MGOURMET FETA AOP", "8.58 EUR", { qty: "2", mark: "T" }),
    L("2e a -40%", "-1.72 EUR"),
    L("JEUNE POUSSE MX BI", "2.39 EUR"),
    L("TOTAL HORS PROMOTION :", "10.97 EUR"),
    L("NOMBRE D'ARTICLES", "3"),
  ]));
  const c = runChecks(r);
  eq("14 totaux", r.printed, { gross_cents: 1097, discounts_cents: null, paid_cents: null, n_items: 3, n_lines: null });
  eq("14 pas d'erreur de %", c.errors, []);
  eq("14 relecture (payé absent)", c.needs_review, true);
}

// --- 15. EAN : clé de contrôle
eq("15 EAN-13 valide", isValidEan("3270190174349"), true);
eq("15 EAN-13 clé fausse", isValidEan("3270190174348"), false);
eq("15 EAN-8 valide", isValidEan("20083960"), true);
eq("15 pas un EAN", [isValidEan("abc"), isValidEan("123"), isValidEan(null)], [false, false, false]);

// --- 16. Formats
eq("16 190G", parseSizes("PRINGLES ORIG 190G"), [{ total: 190, unit: "g" }]);
eq("16 6X25CL", parseSizes("COCA 6X25CL"), [{ total: 1500, unit: "ml" }, { total: 250, unit: "ml", per: true }]);
eq("16 1,5L", parseSizes("EVIAN 1,5L"), [{ total: 1500, unit: "ml" }]);
eq("16 X30CAPS", parseSizes("L'OR ESPRESSO FORZA X30CAPS"), [{ total: 30, unit: "u" }]);
eq("16 800 g (8 x 100 g) ~ 8X100G", sizesMatch(parseSizes("*8X100G FRO BLC NAT"), parseSizes("800 g(8 x 100 g)")), true);
eq("16 650G ≠ 400g", sizesMatch(parseSizes("650G RAVIOLI"), parseSizes("400 g")), false);
eq("16 8X100G ≠ 4 x 100 g", sizesMatch(parseSizes("*8X100G FRO BLC NAT"), parseSizes("400 g (4 x 100 g)")), false);
eq("16 6X25CL ~ 25 cl", sizesMatch(parseSizes("COCA 6X25CL"), parseSizes("25 cl")), true);

eq("16 variantes de format", quantityVariants({ total: 1750, unit: "ml" }).slice(0, 4), ["1.75 l", "1.75l", "1,75 l", "1,75l"]);

// --- 17. Marque de distributeur
eq("17 MDD", [privateLabel("Carrefour Market"), privateLabel("E.Leclerc"), privateLabel("Super U"), privateLabel("Lidl")], ["Carrefour", "Marque Repère", "U", null]);

// --- 18. Classement : le libellé du ticket pèse le plus
{
  const c = (ean: string, name: string, brand: string | null, quantity: string | null, ref?: number): Candidate =>
    ({ ean, name, brand, quantity, image_url: null, source: "off", reference: ref ? { cents: ref, scope: "chain", n: 3 } : null });
  const guess = {
    words: [{ raw: "RAVIOLI", expanded: "raviolis" }, { raw: "VEGET", expanded: "végétariens" }],
    brand: null, brand_raw: null, product_type: "raviolis", product_type_raw: "RAVIOLI",
    variant: "végétariens", size: "650G", full_name: "Raviolis végétariens 650 g", category: "food" as const,
  };
  const r = rank([
    c("3560070602735", "Grands Ravioli Cèpes", "Carrefour", "250 g", 290),
    c("3270190174349", "Ravioli vegetariens", "Carrefour Bio", "650 g", 345),
    c("3560071255589", "Ravioli Végétariens", "Carrefour Veggie", "650g"),
    c("1234567890128", "Lasagnes végétariennes", "Carrefour", "650 g", 345),
  ], { rawLabel: "*650G RAVIOLI VEGET", guess, chain: "Carrefour Market", unitPriceCents: 345 });
  eq("18 bon produit en tête", r.candidates[0].ean, "3270190174349");
  const lasagnes = r.candidates.find((x) => x.ean === "1234567890128")!;
  eq("18 lasagnes pénalisées (type absent)", lasagnes.reasons.some((x) => x.startsWith("type « raviolis » absent")), true);
  eq("18 les deux raviolis végétariens devant", r.candidates.slice(0, 2).map((x) => x.ean).sort(), ["3270190174349", "3560071255589"]);
  eq("18 marque supposée signalée", r.uncertain_reasons.includes("marque supposée"), true);
  console.log("     → raisons du 1er :", r.candidates[0].reasons.join(" · "));
}

// --- 19. Cache des recherches : réponses vides expirées après 24 h, erreurs jamais mises en cache
eq("19 vide", [isEmptyResult(null), isEmptyResult([]), isEmptyResult({ hits: [] }), isEmptyResult({ items: [1] }), isEmptyResult({ products: [] }), isEmptyResult({ code: "1" })],
  [true, true, true, false, true, false]);
{
  const now = Date.now();
  eq("19 frais", [isFresh({ empty: false, at: 0 }, now), isFresh({ empty: true, at: now - 3_600_000 }, now), isFresh({ empty: true, at: now - 25 * 3_600_000 }, now)],
    [true, true, false]);
}

// --- 20. Garde-fou marque (validation auto seulement) : un produit d'une autre marque que celle du registre lue sur
// le ticket n'est jamais validé automatiquement (ex. le vrai Coca-Cola sur la ligne NOTCOCA de la démo).
eq("20 conflit de marque",
  [brandConflict("NotCoca", "Coca-Cola"), brandConflict("Coca-Cola", "Coca-Cola"), brandConflict("Coca-Cola", "Coca-Cola Europacific Partners"),
    brandConflict(null, "Coca-Cola"), brandConflict("Lu", null), brandConflict("Bonne Maman", "Bonne maman")],
  [true, false, false, false, true, false]);
{
  const coca: Candidate = { ean: "5449000267412", name: "Coca-Cola goût original", brand: "Coca-Cola", quantity: "1,75 L", image_url: null,
    source: "off", reference: { cents: 245, scope: "chain", n: 5 } };
  const guess = {
    words: [{ raw: "COCA", expanded: "coca" }, { raw: "COLA", expanded: "cola" }],
    brand: "Coca-Cola", brand_raw: "COCA COLA", product_type: "cola", product_type_raw: "COCA COLA",
    variant: null, size: "1.75L", full_name: "Coca-Cola 1,75 L", category: "food" as const,
  };
  const input = { rawLabel: "COCA COLA 1.75L", guess, chain: "Carrefour Market", unitPriceCents: 245 };
  const base = rank([coca], input).confident;
  eq("20 même marque au registre : confiance inchangée", rank([coca], { ...input, registryBrand: "Coca-Cola" }).confident, base);
  eq("20 autre marque au registre : jamais validé auto", rank([coca], { ...input, registryBrand: "NotCoca" }).confident, false);
  console.log("     → confiance sans registre :", base);

  // --- 21. Preuve web (Linkup) : +15 et raison affichée, mais jamais de validation automatique sur cette preuve
  const plain = rank([coca], input).candidates[0];
  const named = rank([{ ...coca, web: 1 }], input);
  eq("21 bonus web", [named.candidates[0].score - plain.score, named.candidates[0].reasons.includes(WEB_REASON)], [15, true]);
  eq("21 bonus web réduit pour les réponses suivantes", rank([{ ...coca, web: 0.7 }], input).candidates[0].score - plain.score, 11);
  eq("21 jamais validé auto sur une preuve web", named.confident, false);
}

async function asyncCases() {
  // Faux fetch : 1er appel 503, 2e appel 200. Si l'erreur était mise en cache, le 2e appel ne partirait pas.
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? new Response("", { status: 503 }) : new Response(JSON.stringify({ hits: [{ code: "1" }] }), { status: 200 });
  }) as typeof fetch;
  const url = `https://search.openfoodfacts.org/test-cache-${Date.now()}`;
  const first = await getJson(url, { retries: 0 }).catch((e) => String(e));
  const second = (await getJson<{ hits: unknown[] }>(url, { retries: 0 }))?.hits.length;
  const third = (await getJson<{ hits: unknown[] }>(url, { retries: 0 }))?.hits.length; // celui-ci vient du cache
  globalThis.fetch = realFetch;
  eq("19 une erreur 503 n'est pas mise en cache, une vraie réponse oui", [String(first).includes("HTTP 503"), second, third, calls], [true, 1, 1, 2]);
}

asyncCases().then(() => {
  console.log(fails ? `\n${fails} échec(s)` : "\nTout passe.");
  process.exit(fails ? 1 : 0);
});
