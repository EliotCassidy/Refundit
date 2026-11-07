// Checks arithmétiques sur un ticket interprété. Fonctions pures.
// Les messages d'erreur sont renvoyés tels quels au modèle pour le retry : ils doivent l'aider.
import type { Interpretation, Totals } from "./interpret";

export type CheckResult = {
  errors: string[];
  skipped: (keyof Totals)[]; // checks impossibles : total non imprimé
  needs_review: boolean;
  computed: Totals; // totaux recalculés à partir des lignes
};

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function runChecks(r: Interpretation): CheckResult {
  const errors: string[] = [];
  const skipped: (keyof Totals)[] = [];

  const gross = sum(r.items.map((i) => i.price_cents));
  const discounts = sum(r.items.map((i) => i.discount_cents)) + sum(r.global_discounts.map((d) => d.amount_cents));
  const computed: Totals = {
    gross_cents: gross,
    discounts_cents: discounts,
    paid_cents: gross - discounts,
    n_items: sum(r.items.map((i) => i.qty)),
    n_lines: r.items.length,
  };

  if (!r.items.length) errors.push("Aucun article lu : recopie toutes les lignes d'articles avec leur montant.");
  if (!r.date) errors.push(`Date illisible (date_raw = ${JSON.stringify(r.date_raw)}) : recopie la date telle qu'imprimée.`);

  // Un total non imprimé → le check correspondant est sauté (et noté).
  const compare = (key: keyof Totals, message: (printed: number, calc: number) => string) => {
    const printed = r.printed[key];
    if (printed == null) skipped.push(key);
    else if (printed !== computed[key]) errors.push(message(printed, computed[key]!));
  };
  compare("gross_cents", (p, c) =>
    `La somme des prix des articles (${eur(c)}) ne correspond pas au total avant remises imprimé (${eur(p)}) : une ligne d'article manque ou un montant est mal recopié.`);
  compare("discounts_cents", (p, c) =>
    `La somme des remises (${eur(c)}) ne correspond pas au total des remises imprimé (${eur(p)}) : une remise manque, est en trop ou mal recopiée.`);
  compare("paid_cents", (p, c) =>
    `Total − remises = ${eur(c)}, mais le ticket indique ${eur(p)} payés : une ligne ou un montant est faux.`);
  compare("n_items", (p, c) =>
    `La somme des quantités (${c}) ne correspond pas au nombre d'articles imprimé (${p}) : une ligne ou une quantité est mal recopiée.`);
  compare("n_lines", (p, c) =>
    `${c} lignes d'articles lues, mais le ticket en annonce ${p} : une ligne d'article manque ou est en trop.`);

  for (const it of r.items) {
    if (it.discount_cents > it.price_cents) {
      errors.push(`La remise de ${eur(it.discount_cents)} sur « ${it.raw_label} » dépasse son prix (${eur(it.price_cents)}) : elle est rattachée au mauvais article.`);
    }
    if (it.discount_pct != null && it.discount_cents > 0) {
      // "-34 %" porte sur la ligne ; "2e à -40 %" porte sur une seule unité.
      const bases = it.qty > 1 ? [it.price_cents, Math.round(it.price_cents / it.qty)] : [it.price_cents];
      const expected = Math.round((it.price_cents * it.discount_pct) / 100);
      if (!bases.some((b) => Math.abs(Math.round((b * it.discount_pct!) / 100) - it.discount_cents) <= 1)) {
        errors.push(`« ${it.discount_text} » : ${it.discount_pct} % de ${eur(it.price_cents)} (« ${it.raw_label} ») font ${eur(expected)}, pas ${eur(it.discount_cents)} : la remise est sous le mauvais article ou mal recopiée.`);
      }
    }
  }

  // Relecture si : une erreur reste, le net payé est absent, ou aucun check arithmétique n'a pu tourner.
  const needs_review = errors.length > 0 || r.printed.paid_cents == null || skipped.length === Object.keys(r.printed).length;
  return { errors, skipped, needs_review, computed };
}
