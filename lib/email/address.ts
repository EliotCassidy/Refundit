// OWNER: Dev 2. Per-claim email addresses on ONE dedicated Gmail account, via plus addressing:
//   refundit.reclamations+claim-8f3e2a1b@gmail.com → delivered to refundit.reclamations@gmail.com.
// Because some brand forms reject "+", the claim reference is also written in the complaint text,
// so a reply can still be matched by "claim-xxxxxxxx" in its subject/body.
// Pure module (no server-only) so scripts can import it.

export const ALIAS_RE = /claim-[0-9a-f]{8}/i;

export function newAlias(randomHex8: string): string {
  return `claim-${randomHex8.toLowerCase()}`;
}

/** Plus address for a claim, or null if no mailbox is configured. */
export function plusAddress(alias: string, gmailUser = process.env.GMAIL_USER): string | null {
  if (!gmailUser || !gmailUser.includes("@")) return null;
  const [local, domain] = gmailUser.split("@");
  return `${local}+${alias}@${domain}`;
}

/** Finds the claim alias in recipient addresses first, then in the subject/body. */
export function findAlias(recipients: string[], subject: string, text: string): string | null {
  for (const r of recipients) {
    const plus = r.toLowerCase().match(/\+(claim-[0-9a-f]{8})@/);
    if (plus) return plus[1];
  }
  const inText = `${subject}\n${text}`.match(ALIAS_RE);
  return inText ? inText[0].toLowerCase() : null;
}
