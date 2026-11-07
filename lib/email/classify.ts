// OWNER: Dev 2. Brand reply → classification (ARCHITECTURE.md §6), via lib/shared/llm.ts.
import "server-only";
import { z } from "zod";
import { generateObject } from "@/lib/shared/llm";

export const ReplyClassificationSchema = z.object({
  classification: z.enum(["acknowledgement", "accepted", "refused", "waiting_input", "other"]),
  reason: z.string(), // one short sentence in French, shown to the user
  requested_fields: z.array(z.string()), // when waiting_input: what the brand asks for (short French labels)
});
export type ReplyClassification = z.infer<typeof ReplyClassificationSchema>;

export async function classifyReply(subject: string, body: string): Promise<ReplyClassification> {
  const prompt = `Tu lis la réponse d'un service consommateurs à une réclamation produit.
Classe-la :
- "acknowledgement" : accusé de réception, la demande est en cours de traitement
- "accepted" : la marque accorde un remboursement, un bon d'achat ou un geste commercial
- "refused" : la marque refuse
- "waiting_input" : la marque demande des informations ou des pièces (numéro de lot, photo, ticket, RIB, adresse…)
- "other" : autre chose
"reason" : une phrase courte en français qui résume la réponse.
"requested_fields" : si "waiting_input", la liste des informations demandées (libellés courts en français), sinon [].

Objet : ${subject}

${body.slice(0, 6000)}`;
  return generateObject(ReplyClassificationSchema, prompt);
}
