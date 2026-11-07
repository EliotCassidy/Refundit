// IBAN helpers (ISO 13616): normalize, validate with the mod-97 checksum, format by groups of 4.
// Pure module: used by the onboarding UI and by POST /api/profile.

export const normalizeIban = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("FR") && iban.length !== 27) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  return remainder === 1;
}

export const formatIban = (raw: string) => normalizeIban(raw).replace(/(.{4})/g, "$1 ").trim();

/** "FR76 •••• •••• •••• •••• ••• 1234" for display. */
export const maskIban = (raw: string) => {
  const iban = normalizeIban(raw);
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
};
