// OWNER: Dev 2. Built-in "Agent View": the H session's steps (actions + screenshots), served by
// our own routes to the claim's owner only. No public H share link (the screenshots show the
// customer's personal data typed into the brand form).
import "server-only";
import { HaiAgentsClient } from "hai-agents";
import { env } from "@/lib/shared/env";

export type AgentStep = {
  at: string;
  kind: "screenshot" | "action" | "thought" | "answer" | "error";
  text: string | null;
  screenshot: string | null; // H resource URL (fetched through our proxy)
  pageUrl: string | null;
};

const H_RESOURCE_HOST = "agp.eu.hcompany.ai";

let client: HaiAgentsClient | undefined;
const h = () => (client ??= new HaiAgentsClient({ apiKey: env("HAI_API_KEY") }));

type RawEvent = { type: string; timestamp?: string; data?: Record<string, unknown> };

function describeAction(req: { toolName?: string; args?: Record<string, unknown> } | undefined): string | null {
  if (!req?.toolName) return null;
  const a = req.args ?? {};
  const el = typeof a.element === "string" ? a.element : null;
  switch (req.toolName) {
    case "click_web": return `Clic : ${el ?? "élément"}`;
    case "write": return `Saisie${el ? ` (${el})` : ""} : ${String(a.text ?? "").slice(0, 80)}`;
    case "select_option": return `Choix « ${String(a.option ?? "")} »${el ? ` dans ${el}` : ""}`;
    case "scroll_web": return `Défilement ${a.direction === "up" ? "vers le haut" : "vers le bas"}`;
    case "go_to_web": return `Ouverture de ${String(a.url ?? "")}`;
    case "answer": return "Réponse finale";
    default: return req.toolName;
  }
}

export async function getAgentSteps(sessionId: string): Promise<AgentStep[]> {
  // H caps page size at 200: walk the pages (agent events only, no metrics).
  const events: RawEvent[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = (await h().sessions.listSessionEvents({ id: sessionId, size: 200, page, type: "AgentEvent" } as never)) as unknown as { items?: RawEvent[] };
    const items = res.items ?? [];
    events.push(...items);
    if (items.length < 200) break;
  }
  const steps: AgentStep[] = [];
  for (const e of events) {
    const d = e.data ?? {};
    const at = e.timestamp ?? "";
    if (d.kind === "observation_event") {
      const image = d.image as { source?: string } | undefined;
      const meta = d.metadata as { url?: string } | undefined;
      if (image?.source) steps.push({ at, kind: "screenshot", text: null, screenshot: image.source, pageUrl: meta?.url ?? null });
    } else if (d.kind === "tool_result") {
      const text = describeAction(d.toolReq as { toolName?: string; args?: Record<string, unknown> });
      if (text) steps.push({ at, kind: "action", text, screenshot: null, pageUrl: null });
    } else if (d.kind === "error_event") {
      steps.push({ at, kind: "error", text: "L'agent a rencontré une erreur et réessaie", screenshot: null, pageUrl: null });
    }
  }
  return steps;
}

/** Only H screenshot URLs of THIS session may be proxied. */
export function isSessionResource(url: string, sessionId: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === H_RESOURCE_HOST && u.pathname.includes(`/trajectories/${sessionId}/resources/`);
  } catch {
    return false;
  }
}

export async function fetchResource(url: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${env("HAI_API_KEY")}` } });
}
