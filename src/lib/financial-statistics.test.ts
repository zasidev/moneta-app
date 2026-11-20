import { describe, expect, it } from "vitest";
import { includedTransactions, transactionTotals } from "./financial-statistics";
import { depositValue } from "./deposit-calculation";

describe("Esclusioni dalle statistiche", () => {
  const rows = [{ id: "income", amount: 200 }, { id: "expense", amount: -70 }, { id: "transfer", amount: -100 }];
  it("esclude un movimento dalle uscite senza cancellarlo", () => {
    expect(transactionTotals(includedTransactions(rows, new Set(["transfer"])))).toEqual({ income: 200, spending: 70 });
    expect(rows).toHaveLength(3);
  });
  it("reincludere ripristina il conteggio", () => {
    expect(transactionTotals(includedTransactions(rows, new Set()))).toEqual({ income: 200, spending: 170 });
  });
  it("esclude anche le entrate", () => {
    expect(transactionTotals(includedTransactions(rows, new Set(["income"])))).toEqual({ income: 0, spending: 170 });
  });
});

describe("Conto deposito a interesse annuo fisso semplice lordo", () => {
  const terms = { principal: 10000, annual_rate: 3.65, start_date: "2026-01-01" };
  it("matura un euro al giorno su 10.000 euro al 3,65%", () => {
    expect(depositValue(terms, "2026-01-02").value).toBe(10001);
    expect(depositValue(terms, "2026-01-03").value).toBe(10002);
  });
  it("non matura prima della data iniziale", () => {
    expect(depositValue(terms, "2025-12-01").value).toBe(10000);
  });
  it("si ferma alla scadenza", () => {
    expect(depositValue({ ...terms, end_date: "2026-01-11" }, "2026-02-01").value).toBe(10010);
  });
  it("applica il tasso annuo senza reinvestire gli interessi", () => {
    expect(depositValue(terms, "2027-01-01").value).toBe(10365);
  });
});