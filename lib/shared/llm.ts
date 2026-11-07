// Single LLM entry point for the whole app (API_CONTRACTS §4).
// OWNER: Dev 1 creates the implementation once the provider is chosen.
// Dev 2 may ADD functions, but not change these signatures without a heads-up.
//
// TODO(dev1): pick the provider, install its SDK, implement both functions using
// LLM_API_KEY / LLM_MODEL. Check the provider's official docs for structured output
// and image input. Always validate the result with the given zod schema.
import "server-only";
import type { z } from "zod";

export type LlmImage = { mediaType: string; base64: string };

export async function generateObject<T>(
  schema: z.ZodType<T>,
  prompt: string,
  opts?: { images?: LlmImage[] },
): Promise<T> {
  void schema; void prompt; void opts;
  throw new Error("lib/shared/llm.ts: generateObject not implemented yet (Dev 1)");
}

export async function generateText(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
  void prompt; void opts;
  throw new Error("lib/shared/llm.ts: generateText not implemented yet (Dev 1)");
}
