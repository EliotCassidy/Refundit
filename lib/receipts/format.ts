// Affichage en français (utilisable côté serveur et client).

export const euros = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const frDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }) : null;
