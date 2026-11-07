// OWNER: Dev 2. Jury demo mode.
// DEMO_EMAIL is the TEMPLATE account: its state is saved (npm run demo -- snapshot) and copied into a fresh,
// throwaway account for every jury ("jury-xxxxxxxx@demo.example.com", deleted 30 min after creation).
export const DEMO_EMAIL = "refundit@demo.fr";
export const DEMO_PASSWORD = "demo123";
/** Fictional receipt offered on the scan page during the demo (NotCoca lines, "TICKET FICTIF"). */
export const DEMO_TICKET = "/demo/ticket-carrefour.png";

const JURY_DOMAIN = "demo.example.com"; // reserved documentation domain: no mailbox, nothing is ever sent there
export const juryEmail = (hex8: string) => `jury-${hex8}@${JURY_DOMAIN}`;
export const isJuryEmail = (email: string | null | undefined) => /^jury-[0-9a-f]{8}@demo\.example\.com$/.test((email ?? "").toLowerCase());
/** Template or jury account (demo-only shortcuts such as the NotCoca back-office auto-login). */
export const isDemoEmail = (email: string | null | undefined) => (email ?? "").toLowerCase() === DEMO_EMAIL || isJuryEmail(email);
