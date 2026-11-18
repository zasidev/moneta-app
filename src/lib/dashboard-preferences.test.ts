import { describe, expect, it } from "vitest";
import { financialValue, storedTheme } from "./dashboard-preferences";

describe("Dashboard preferences", () => {
  it("hides monetary values regardless of amount or currency", () => {
    expect(financialValue(24850, "EUR", true)).toBe("••••••");
    expect(financialValue(-84.5, "USD", true)).toBe("••••••");
  });
  it("shows amounts when privacy is disabled", () => {
    expect(financialValue(24850, "EUR", false)).toContain("24.850,00");
  });
  it("retains an explicit light choice even with a dark system theme", () => {
    expect(storedTheme("light", true)).toBe("light");
  });
  it("retains an explicit dark choice even with a light system theme", () => {
    expect(storedTheme("dark", false)).toBe("dark");
  });
});