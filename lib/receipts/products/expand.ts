// Le LLM développe le libellé abrégé du ticket. C'est une HYPOTHÈSE (llm_guess) :
// elle sert à formuler les recherches et à repérer la marque / le type écrits sur le ticket,
// mais n'est JAMAIS utilisée comme résultat (CLAUDE.md règle 8).
import "server-only";
import { z } from "zod";
import { generateObject } from "@/lib/shared/llm";

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

const prompt = (label: string, chain: string | null, section: string | null) => `Libellé abrégé d'un ticket de caisse français : « ${label} »
Enseigne : ${chain ?? "inconnue"}. Rayon imprimé : ${section ?? "aucun"}.

Développe ce libellé mot par mot. Ce n'est qu'une hypothèse pour lancer une recherche de produit.
Développe vraiment chaque abréviation ; ne recopie un mot tel quel que si tu ne le comprends pas du tout.
Exemples (d'autres produits) :
- « CR.FRAICHE EP.30% 20CL » → crème fraîche épaisse 30 % 20 cl
- « YAO.NAT.BIO 4X125G » → yaourt nature bio 4 x 125 g
- « JB DD SUP X4 » → jambon découenné dégraissé supérieur x4
- « LPM GEL DCHE 250ML » → gel douche Le Petit Marseillais 250 ml (brand "Le Petit Marseillais", brand_raw "LPM")
- "brand" : la marque UNIQUEMENT si elle est écrite dans le libellé (en entier, abrégée ou en initiales, ex. "LPM" = Le Petit Marseillais). Sinon null. Ne devine pas une marque absente du libellé.
- "brand_raw" et "product_type_raw" : le mot exact du libellé, tel qu'imprimé, ou null.
- Si un mot est illisible ou incompréhensible, recopie-le tel quel dans "expanded".
Réponds uniquement en JSON.`;

export async function expandLabel(label: string, chain: string | null, section: string | null): Promise<Guess | null> {
  try {
    return await generateObject(GuessSchema, prompt(label, chain, section));
  } catch (err) {
    console.error("[expandLabel]", label, err);
    return null; // sans hypothèse, on cherche avec le libellé brut
  }
}
