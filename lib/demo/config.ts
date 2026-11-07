// OWNER: Dev 2. Jury demo mode: the shared demo account (public on purpose: it is typed on the login page).
export const DEMO_EMAIL = "refundit@demo.fr";
export const DEMO_PASSWORD = "demo123";
/** Fictional receipt offered on the scan page during the demo (NotCoca lines, "TICKET FICTIF"). */
export const DEMO_TICKET = "/demo/ticket-carrefour.png";

export const isDemoEmail = (email: string | null | undefined) => (email ?? "").toLowerCase() === DEMO_EMAIL;
