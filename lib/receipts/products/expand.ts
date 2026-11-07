// Le LLM développe le libellé abrégé du ticket. C'est une HYPOTHÈSE (llm_guess) :
// elle sert à formuler les recherches et à repérer la marque / le type écrits sur le ticket,
// mais n'est JAMAIS utilisée comme résultat (CLAUDE.md règle 8).
import "server-only";
import { z } from "zod";
import { generateObject, llmModel } from "@/lib/shared/llm";
import { cached } from "./net";

export const GuessSchema = z.object({
  words: z.array(z.object({ raw: z.string(), expanded: z.string() })), // chaque mot du libellé, développé
  brand: z.string().nullable(), // marque, seulement si elle est ÉCRITE dans le libellé (en entier, abrégée ou en initiales)
  brand_raw: z.string().nullable(), // le mot du libellé qui porte la marque, tel qu'imprimé
  product_type: z.string().nullable(), // type de produit, ex. "raviolis", "dentifrice"
  product_type_raw: z.string().nullable(), // le mot du libellé qui porte le type, tel qu'imprimé
  variant: z.string().nullable(), // ex. "végétariens", "nature", "anti-tartre"
  size: z.string().nullable(), // format tel qu'écrit, ex. "650G"
  full_name: z.string(), // nom complet supposé, ex. "Raviolis végétariens 650 g"
  category: z.enum(["food", "beauty_hygiene", "household", "other"]),
});
export type Guess = z.infer<typeof GuessSchema>;

const prompt = (label: string, chain: string | null, section: string | null, unitPriceCents: number | null) => `Libellé d'un article sur un ticket de caisse ${chain ?? "de supermarché"} (France) : « ${label} »
(rayon : ${section ?? "inconnu"}, prix : ${unitPriceCents ? (unitPriceCents / 100).toFixed(2).replace(".", ",") + " €" : "inconnu"}).
Les libellés sont abrégés et tronqués à environ 18 caractères. Retrouve le produit réel : c'est une hypothèse
qui sert seulement à lancer une recherche. Réponds uniquement en JSON.

- "words" : CHAQUE mot ou abréviation du libellé et ce qu'il signifie (marque, type de produit, gamme, parfum,
  origine, format…). Aucun mot ne doit être ignoré. Développe vraiment les abréviations ; ne recopie un mot tel quel
  que si tu ne le comprends pas du tout.
- "brand" : la marque si elle est écrite dans le libellé (en entier, abrégée ou en initiales, ex. "LPM" = Le Petit
  Marseillais), sinon null. Un nom propre du libellé (ex. "HEINEKEN", "DANONE") est en général la marque.
  Ne devine pas une marque absente du libellé.
- "brand_raw" et "product_type_raw" : le mot exact du libellé, tel qu'imprimé, ou null.
- "product_type" : le type de produit précis en français, en reprenant le mot du libellé quand il y en a un
  (ex. "YAOURT" → "yaourt", pas "produit laitier" ; "SH" → "shampooing").
- "variant" : la gamme, la variété, le parfum ou l'origine lus dans le libellé, sinon null.
- "size" : seulement si un format (nombre + unité) est écrit dans le libellé, sinon null.
- "full_name" : le nom complet du produit, tel qu'il serait écrit sur l'emballage.
- "category" : "food", "beauty_hygiene", "household" ou "other".

Exemples (d'autres produits) :
- « CR.FRAICHE EP.30% 20CL » → crème fraîche épaisse 30 % 20 cl (type "crème fraîche", variant "épaisse 30 %")
- « YAO.NAT.BIO 4X125G » → yaourt nature bio 4 x 125 g (type "yaourt", variant "nature bio")
- « JB DD SUP X4 » → jambon découenné dégraissé supérieur x4 (type "jambon")
- « LPM GEL DCHE 250ML » → gel douche Le Petit Marseillais 250 ml (brand "Le Petit Marseillais", brand_raw "LPM", type "gel douche")`;

export async function expandLabel(
  label: string,
  chain: string | null,
  section: string | null,
  unitPriceCents: number | null,
): Promise<Guess | null> {
  try {
    // Mise en cache par (modèle, prompt) : un même libellé n'est payé qu'une fois.
    const text = prompt(label, chain, section, unitPriceCents);
    return await cached(`llm:${llmModel()}:${text}`, () => generateObject(GuessSchema, text));
  } catch (err) {
    console.error("[expandLabel]", label, err);
    return null; // sans hypothèse, on cherche avec le libellé brut
  }
}
