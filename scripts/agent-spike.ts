// OWNER: Dev 2. H spike (IMPLEMENTATION_PLAN.md Phase 1): run the agent in DRY RUN on a
// brand contact form and report what happened. Never submits a form.
//
//   npm run spike -- <contact_url> [--brand "Pringles"] [--product "Pringles Original 175g"] [--agent h/web-surfer-pro] [--receipt path/to/receipt.jpg]
//
// Prints the Agent View URL right away (watch it live), then the structured answer.
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { HaiAgentsClient } from "hai-agents";
import { buildComplaintText } from "../lib/agent/complaint";
import { buildInstruction } from "../lib/agent/instruction";
import { AgentAnswerSchema } from "../lib/shared/types";

config({ path: ".env.local" });

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    brand: { type: "string" },
    agent: { type: "string", default: process.env.AGENT_ID || "h/web-surfer-flash" },
    receipt: { type: "string" },
    product: { type: "string" }, // e.g. "Coca-Cola Original 1,75 L"
  },
});
const contactUrl = positionals[0];
if (!contactUrl) {
  console.error('Usage: npm run spike -- <contact_url> [--brand "Pringles"] [--agent h/web-surfer-pro] [--receipt file.jpg]');
  process.exit(1);
}

const receiptFile = values.receipt
  ? {
      name: `ticket-de-caisse${extname(values.receipt) || ".jpg"}`,
      source: readFileSync(values.receipt).toString("base64"),
      type: "base64" as const,
      mediaType: extname(values.receipt).toLowerCase() === ".png" ? "image/png" : "image/jpeg",
    }
  : null;

const brand = values.brand ?? null;
const complaintText = buildComplaintText({
  firstName: "Camille",
  lastName: "Test",
  productName: values.product ?? (brand ? `${brand} (produit test)` : "Produit test"),
  brandName: brand,
  storeName: "Carrefour Market",
  purchasedAt: new Date().toISOString(),
  totalPriceCents: 289,
  issueType: "damaged",
  issueDescription: "TEST TECHNIQUE — ce formulaire ne doit pas être envoyé.",
  hasReceiptAttachment: Boolean(receiptFile),
});

const instruction = buildInstruction({
  contactUrl,
  agentHints: null,
  dryRun: true, // ALWAYS dry run in the spike
  customer: {
    firstName: "Camille",
    lastName: "Test",
    addressLine1: "1 rue de la Paix",
    addressLine2: null,
    postalCode: "75002",
    city: "Paris",
    country: "France",
    phone: "0600000000",
    email: "spike@inbound.invalid",
  },
  product: { name: values.product ?? "Produit test", brand, ean: null, purchasedAt: new Date().toISOString(), storeName: "Carrefour Market", priceCents: 289 },
  complaintText,
  receiptFileName: receiptFile?.name ?? null,
});

async function main() {
  const client = new HaiAgentsClient({ apiKey: process.env.HAI_API_KEY });
  const started = Date.now();
  const session = await client.startSession({
    agent: values.agent!,
    messages: { type: "user_message", message: instruction, files: receiptFile ? [receiptFile] : undefined },
    answerSchema: AgentAnswerSchema,
    overrides: { "agent.environments[kind=web].start_url": contactUrl },
    maxSteps: 60,
    maxTimeS: 600,
    timezone: "Europe/Paris",
    idleTimeoutS: null,
  });
  const details = await session.get();
  console.log(`\nSession ${session.id} (${values.agent})`);
  console.log(`Agent View: ${details.agentViewUrl ?? "n/a"}\n`);
  console.log("Waiting for the agent… (Ctrl+C stops waiting, not the session)");

  const result = await session.waitForCompletion({ timeoutMs: 15 * 60_000 });
  const status = await session.status();
  const seconds = Math.round((Date.now() - started) / 1000);

  if (result.status === "idle") await session.cancel().catch(() => undefined); // free the slot
  console.log("\n=== Spike result ===");
  console.log(JSON.stringify({
    url: contactUrl,
    brand,
    agent: values.agent,
    receipt: receiptFile ? basename(values.receipt!) : null,
    status: result.status,
    outcome: status.outcome ?? null,
    errorCode: status.errorCode ?? null,
    steps: status.steps ?? null,
    seconds,
    answer: result.answer,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
