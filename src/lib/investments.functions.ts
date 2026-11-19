import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { investmentClient, type HoldingInput, type Price } from "@/lib/investment-types";

export const listHoldings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await investmentClient(context.supabase)
      .from("investment_holdings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: HoldingInput) => d)
  .handler(async ({ data, context }) => {
    const d = data;
    const { data: saved, error } = await investmentClient(context.supabase)
      .from("investment_holdings")
      .upsert({ ...d, user_id: context.userId, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const dd = d as { id?: unknown };
    if (typeof dd.id !== "string") throw new Error("ID non valido");
    return { id: dd.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await investmentClient(context.supabase)
      .from("investment_holdings")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fetchPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: holdings } = await investmentClient(context.supabase)
      .from("investment_holdings")
      .select("ticker, currency");
    if (!holdings?.length) return { updated: 0 };
    const tickers = [...new Set(holdings.map((h) => h.ticker).filter(Boolean))] as string[];
    const results: Price[] = [];
    for (const t of tickers) {
      const p = await fetchQuote(t).catch(() => null);
      if (p) results.push(p);
    }
    for (const p of results) {
      await investmentClient(context.supabase).from("investment_prices").upsert(
        {
          ticker: p.ticker,
          price: p.price,
          currency: p.currency,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "ticker" },
      );
    }
    return { updated: results.length };
  });

async function fetchQuote(ticker: string): Promise<Price | null> {
  const res = await fetch(
    `https://stooq.com/q/l/?s=${encodeURIComponent(ticker)}&f=sd2t2ohlc&h&e=csv`,
  );
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;
  const [headerLine, dataLine] = lines;
  if (!headerLine || !dataLine) return null;
  const header = headerLine.split(",");
  const row = dataLine.split(",");
  const get = (key: string) => row[header.indexOf(key)] ?? "";
  const close = Number(get("close"));
  if (!close) return null;
  return { ticker, price: close, currency: "EUR", fetched_at: new Date().toISOString() };
}
