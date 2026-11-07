// Shared UI formatting helpers.

/** "NOTCOCA ORIGINAL 1.75L" → "Notcoca original 1.75L" (receipt labels are often all caps). Display only. */
export function displayLabel(label: string): string {
  const letters = label.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return label;
  const lower = label.toLocaleLowerCase("fr-FR").replace(/(\d)(l|g|cl|ml|kg)\b/g, (_, d, u) => `${d}${u === "l" ? "L" : u}`);
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}

const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const long = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
export const shortDate = (iso: string) => short.format(new Date(iso));
export const dateTime = (iso: string) => long.format(new Date(iso));
