// Point d'entrée LLM unique de l'app (API_CONTRACTS §4). OWNER: Dev 1.
// Dev 2 peut AJOUTER des fonctions, mais pas changer ces signatures sans prévenir.
//
// API compatible OpenAI configurée par le .env : LLM_URL, LLM_API_KEY, LLM_MODEL.
// Changer de modèle = changer le .env, jamais le code.
// Par défaut : H Models API (https://api.hcompany.ai/v1, holo4-35b-a3b).
// Doc vérifiée le 2026-11-07 (hub.hcompany.ai/models-api/chat-completions) :
// - la réflexion est activée par défaut ; reasoning_effort est ignoré par holo4-35b-a3b,
//   seul chat_template_kwargs.enable_thinking=false la coupe sur tous les modèles ;
// - la réflexion revient dans message.reasoning (pas dans content) ;
// - response_format {type:"json_schema"} est supporté ; images JPEG/PNG/WebP, 5 max.
import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env";

export type LlmImage = { mediaType: string; base64: string };
export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

export type ChatOptions = {
  maxTokens?: number;
  timeoutMs?: number; // délai max de l'appel (défaut 45 s)
  thinking?: boolean; // défaut false
  jsonSchema?: { name: string; schema: Record<string, unknown> }; // sortie contrainte
};

export type ChatResult = { content: string; finishReason: string | null; ms: number };

const DEFAULT_TIMEOUT_MS = 45_000;

let client: OpenAI | undefined;
function getClient() {
  // maxRetries 0 : on garde la main sur le temps total (maxDuration Vercel).
  client ??= new OpenAI({ baseURL: env("LLM_URL"), apiKey: env("LLM_API_KEY"), maxRetries: 0 });
  return client;
}

/** Nom du modèle utilisé (pour le tracer dans raw_parse). */
export function llmModel(): string {
  return env("LLM_MODEL");
}

/** Message utilisateur avec texte + images en base64. */
export function userMessage(text: string, images: LlmImage[] = []): ChatMessage {
  return {
    role: "user",
    content: [
      { type: "text", text },
      ...images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
      })),
    ],
  };
}

/** Appel bas niveau, multi-tours (utilisé pour le retry du parser). temperature 0. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
    chat_template_kwargs?: { enable_thinking: boolean };
  } = {
    model: llmModel(),
    messages,
    temperature: 0,
    max_tokens: opts.maxTokens ?? 4096,
    chat_template_kwargs: { enable_thinking: opts.thinking ?? false },
  };
  if (opts.jsonSchema) body.response_format = { type: "json_schema", json_schema: opts.jsonSchema };

  const t0 = Date.now();
  const res = await getClient().chat.completions.create(body, { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  const choice = res.choices[0];
  return {
    content: stripThinking(choice?.message?.content ?? ""),
    finishReason: choice?.finish_reason ?? null,
    ms: Date.now() - t0,
  };
}

/** Retire les balises <think>…</think> si un modèle les met quand même dans le texte. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^[\s\S]*<\/think>/, "") // balise ouvrante absente
    .trim();
}

/**
 * Parsing tolérant : dernier bloc ```json valide, sinon le dernier objet JSON
 * trouvé dans le texte. Renvoie undefined si rien n'est parsable.
 */
export function extractJson(text: string): unknown {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const block of blocks.reverse()) {
    const value = tryParse(block);
    if (value !== undefined) return value;
  }
  // Objets {…} de premier niveau, en respectant les chaînes.
  const objects: string[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"' && depth > 0) inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0) objects.push(text.slice(start, i + 1));
    }
  }
  for (const obj of objects.reverse()) {
    const value = tryParse(obj);
    if (value !== undefined) return value;
  }
  return undefined;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** JSON Schema d'un schéma zod, au format attendu par response_format. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return rest;
}

export async function generateObject<T>(
  schema: z.ZodType<T>,
  prompt: string,
  opts?: { images?: LlmImage[] },
): Promise<T> {
  const { content } = await chat([userMessage(prompt, opts?.images)], {
    jsonSchema: { name: "answer", schema: toJsonSchema(schema) },
  });
  const value = extractJson(content);
  if (value === undefined) throw new Error(`LLM: réponse sans JSON (${content.slice(0, 200)})`);
  return schema.parse(value);
}

export async function generateText(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
  const { content } = await chat([userMessage(prompt)], { maxTokens: opts?.maxTokens });
  return content;
}
