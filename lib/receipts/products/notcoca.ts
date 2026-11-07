// Marque de démo FICTIVE NotCoca (servie par l'app sur /notcoca) : absente d'Open Food Facts, qui ne propose donc que du
// vrai Coca-Cola. Quand le libellé nomme NotCoca (marque du registre), les produits viennent de son propre catalogue
// (recettes de lib/notcoca/catalog.ts), avec le format lu sur le ticket et la photo de la canette NotCoca.
// EAN fictifs : préfixe GS1 20-29 (usage interne, jamais un vrai produit), clé de contrôle valide.
import { DRINKS } from "@/lib/notcoca/catalog";
import type { ProductCandidates } from "@/lib/shared/types";
import { normalize } from "../text";
import { parseSizes } from "./ean";

export const DEMO_BRAND = "NotCoca";

// Même ordre que DRINKS (Original, Zéro, Cherry, Citron) ; mots du ticket qui désignent la recette.
const RECIPES: { id: string; words: string[] }[] = [
  { id: "original", words: [] },
  { id: "zero", words: ["ZERO", "ZER0", "LIGHT"] },
  { id: "cherry", words: ["CHERRY", "CERISE"] },
  { id: "citron", words: ["CITRON", "LEMON"] },
];
// Formats (ml → texte). Le 1er (1,75 L) a le code 00 : NotCoca Original 1,75 L = 2000000000008, comme dans le seed.
const SIZES: [number, string][] = [[1750, "1,75 L"], [330, "33 cl"], [500, "50 cl"], [1000, "1 L"], [1250, "1,25 L"], [1500, "1,5 L"], [2000, "2 L"]];

function fakeEan(recipe: number, size: number, pack: number): string {
  const body = `20000${recipe}${String(size).padStart(2, "0")}${String(pack).padStart(2, "0")}00`;
  const sum = body.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body + ((10 - (sum % 10)) % 10);
}

/** Propositions NotCoca pour ce libellé : la recette lue sur le ticket en premier (validée directement), puis les autres. */
export function notcocaCandidates(rawLabel: string): ProductCandidates {
  const words = normalize(rawLabel).split(" ");
  const recipe = Math.max(0, RECIPES.findIndex((r) => r.words.some((w) => words.includes(w))));

  // « 6X33CL » → lot de 6 × 33 cl ; « 1.5L » → 1,5 L
  const sizes = parseSizes(rawLabel).filter((s) => s.unit === "ml");
  const per = sizes.find((s) => s.per);
  const total = sizes.find((s) => !s.per);
  const unitMl = per?.total ?? total?.total ?? null;
  const pack = per && total ? Math.round(total.total / per.total) : 1;
  const size = SIZES.findIndex(([ml]) => ml === unitMl);
  const format = size >= 0 ? SIZES[size][1] : null;
  const quantity = format ? (pack > 1 ? `${pack} x ${format}` : format) : null;

  const order = [recipe, ...RECIPES.keys()].filter((i, n, all) => all.indexOf(i) === n);
  return {
    llm_guess: null,
    candidates: order.map((i, rank) => ({
      ean: fakeEan(i, size >= 0 ? size : 99, pack > 1 ? pack : 0),
      brand: DEMO_BRAND,
      name: DRINKS[i],
      quantity,
      image_url: `/notcoca/cans/${RECIPES[i].id}.png`,
      source: "catalog" as const,
      score: rank === 0 ? 100 : 50,
      reference_price_cents: null,
      reasons: rank === 0 ? ["marque NotCoca lue sur le ticket", "catalogue de la marque (fictive)"] : ["autre recette NotCoca"],
    })),
    uncertain: false,
    uncertain_reasons: [],
    confident: true,
    searched_at: new Date().toISOString(),
  };
}
