import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Holding = {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  currency: string;
  quantity: number;
  purchase_price: number | null;
  purchase_date: string | null;
  platform: string | null;
  created_at: string;
  updated_at: string;
};
export type HoldingInput = Pick<Holding, "ticker" | "quantity"> & {
  [Key in keyof Omit<Holding, "ticker" | "quantity">]?: Holding[Key] | undefined;
};
export type Price = { ticker: string; price: number; currency: string; fetched_at: string };
type CustomTable<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
type InvestmentDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      investment_holdings: CustomTable<Holding, HoldingInput>;
      investment_prices: CustomTable<Price, Price>;
    };
  };
};

// Custom tables are maintained outside the generated Cloud schema. This changes
// only TypeScript's table definitions, preserving the client's session and RLS.
export function investmentClient(client: SupabaseClient<Database>) {
  return client as SupabaseClient<InvestmentDatabase>;
}