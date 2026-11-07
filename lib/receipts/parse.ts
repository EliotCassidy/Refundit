// OWNER: Dev 1. Receipt image → ParsedReceipt (API_CONTRACTS §3).
import "server-only";
import { generateObject } from "@/lib/shared/llm";
import { ParsedReceiptSchema, type ParsedReceipt } from "@/lib/shared/types";

// TODO(dev1): tune this prompt on 3 real French receipts.
const PROMPT = `Tu lis un ticket de caisse de supermarché français.
Extrais le magasin, la date d'achat (ISO 8601), le total en centimes et chaque ligne produit.
Pour chaque ligne : le libellé brut exact, un nom de produit lisible, la marque probable (ou null),
la quantité, le prix unitaire et le prix total en centimes.
N'invente rien : si une information est illisible, mets null.`;

export async function parseReceipt(image: { mediaType: string; base64: string }): Promise<ParsedReceipt> {
  return generateObject(ParsedReceiptSchema, PROMPT, { images: [image] });
}
