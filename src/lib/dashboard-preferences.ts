export const privacyKey = "conto-chiaro:hide-balances";
export const themeKey = "conto-chiaro:theme";

export function financialValue(value: number, currency = "EUR", hidden = false) {
  if (hidden) return "••••••";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(value);
}

export function storedTheme(value: string | null, systemDark: boolean): "light" | "dark" {
  return value === "light" || value === "dark" ? value : systemDark ? "dark" : "light";
}