// OWNER: Dev 1. Photo du ticket → ParsedReceipt (API_CONTRACTS §3) + extraction complète (receipts.raw_parse).
// Le modèle recopie (prompt ci-dessous), interpret.ts interprète, checks.ts vérifie.
// Si un check échoue : UN retry avec la réponse précédente et la liste des erreurs.
import "server-only";
import { chat, extractJson, llmModel, toJsonSchema, userMessage, type ChatMessage, type LlmImage } from "@/lib/shared/llm";
import { ParsedReceiptSchema, type ParsedReceipt } from "@/lib/shared/types";
import { interpret, toPurchasedAt, TranscriptionSchema, type Interpretation, type Transcription } from "./interpret";
import { runChecks, type CheckResult } from "./checks";

const PROMPT = `Tu recopies un ticket de caisse de supermarché, ligne par ligne. Tu ne corriges rien et tu n'interprètes rien.

Réponds uniquement avec un objet JSON de la forme :
{"store": {"chain": ..., "name": ...}, "date_raw": ..., "time_raw": ..., "lines": [{"section": ..., "mark": ..., "text": ..., "qty": ..., "amount": ...}]}

- "lines" : TOUTES les lignes qui portent un montant ou une quantité, dans l'ordre du ticket, de haut en bas : articles, lignes de quantité ("2 x 1,99"), remises, sous-totaux, totaux, récapitulatifs, nombre d'articles, paiements, rendu monnaie. N'en saute aucune, même si elle te semble répétée.
- "text" : le texte de la ligne recopié EXACTEMENT, caractère par caractère, abréviations et fautes comprises, sans le montant.
- "amount" : le montant de la ligne tel qu'imprimé, en texte, avec son signe ("1,99", "-0,50", "0,50-"). null s'il n'y en a pas.
- "qty" : la quantité si elle est imprimée dans une colonne à part, en texte. null sinon.
- "section" : l'en-tête de rayon sous lequel se trouve la ligne (ex. "EPICERIE"). null s'il n'y en a pas.
- "mark" : une lettre ou un symbole isolé dans la marge de la ligne (ex. "T", "*"). null sinon.
- "store.chain" (enseigne) et "store.name" (nom du magasin) : seulement s'ils sont imprimés sur le ticket, sinon null. Ne devine pas.
- "date_raw" et "time_raw" : la date et l'heure d'achat telles qu'imprimées (ex. "17/12/25", "13h55"). null si absentes.`;

const retryPrompt = (errors: string[]) => `Ta transcription ne passe pas ces vérifications arithmétiques :
${errors.map((e) => `- ${e}`).join("\n")}

Relis le ticket et recopie-le à nouveau EN ENTIER, au même format JSON, en corrigeant les lignes concernées. Ne change pas un montant juste pour faire tomber les comptes : recopie ce qui est imprimé.`;

const TRANSCRIPTION_SCHEMA = { name: "ticket", schema: toJsonSchema(TranscriptionSchema) };

type Attempt = {
  content: string;
  ms: number;
  finishReason: string | null;
  transcription: Transcription | null;
  interpretation: Interpretation | null;
  checks: CheckResult | null;
  errors: string[];
};

async function attempt(messages: ChatMessage[]): Promise<Attempt> {
  const res = await chat(messages, { maxTokens: 8192, jsonSchema: TRANSCRIPTION_SCHEMA });
  const base = { content: res.content, ms: res.ms, finishReason: res.finishReason };
  const parsed = TranscriptionSchema.safeParse(extractJson(res.content));
  if (!parsed.success) {
    const why = res.finishReason === "length" ? "réponse tronquée (trop longue)" : "JSON invalide ou incomplet";
    return { ...base, transcription: null, interpretation: null, checks: null, errors: [`Réponse illisible : ${why}.`] };
  }
  const interpretation = interpret(parsed.data);
  const checks = runChecks(interpretation);
  return { ...base, transcription: parsed.data, interpretation, checks, errors: checks.errors };
}

/** Tout ce qu'on garde dans receipts.raw_parse (l'interprétation complète + la trace des essais). */
export type ReceiptExtraction = Interpretation & {
  version: 1;
  model: string;
  attempts: number;
  attempt_errors: string[][]; // erreurs de chaque essai
  ms: number;
  check_errors: string[];
  checks_skipped: string[];
  needs_review: boolean;
  computed: CheckResult["computed"];
  lines: Transcription["lines"]; // transcription brute retenue
};

export type ParseResult = { parsed: ParsedReceipt; extraction: ReceiptExtraction };

export async function parseReceipt(image: LlmImage): Promise<ParseResult> {
  const first: ChatMessage[] = [userMessage(PROMPT, [image])];
  const a1 = await attempt(first);
  let final = a1;
  const attempts = [a1];

  if (a1.errors.length) {
    const a2 = await attempt([
      ...first,
      { role: "assistant", content: a1.content },
      userMessage(retryPrompt(a1.errors)),
    ]);
    attempts.push(a2);
    // On garde le retry seulement s'il n'a pas plus d'erreurs.
    if (a2.interpretation && (!a1.interpretation || a2.errors.length <= a1.errors.length)) final = a2;
  }

  if (!final.interpretation || !final.checks || !final.transcription) {
    throw new Error(`Ticket illisible après ${attempts.length} essai(s) : ${final.errors.join(" ")}`);
  }

  const r = final.interpretation;
  const extraction: ReceiptExtraction = {
    version: 1,
    model: llmModel(),
    ...r,
    attempts: attempts.length,
    attempt_errors: attempts.map((a) => a.errors),
    ms: attempts.reduce((t, a) => t + a.ms, 0),
    check_errors: final.checks.errors,
    checks_skipped: final.checks.skipped,
    needs_review: final.checks.needs_review,
    computed: final.checks.computed,
    lines: final.transcription.lines,
  };

  // Format du contrat. product_name = raw_label tant que le produit n'est pas confirmé (CLAUDE.md règle 1).
  const parsed = ParsedReceiptSchema.parse({
    store_name: r.store.name ?? r.store.chain,
    purchased_at: toPurchasedAt(r.date, r.time),
    currency: "EUR",
    total_cents: r.printed.paid_cents,
    items: r.items.map((it) => ({
      raw_label: it.raw_label,
      product_name: it.raw_label,
      brand_guess: null,
      quantity: it.qty,
      unit_price_cents: it.unit_price_cents,
      total_price_cents: it.paid_cents,
    })),
  });
  return { parsed, extraction };
}
