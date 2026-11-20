import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data non valida");
const depositSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  principal: z.number().finite().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  annual_rate: z.number().finite().min(0).max(100),
  start_date: date,
  end_date: date.nullable(),
}).refine((d) => !d.end_date || d.end_date >= d.start_date, "Scadenza precedente all’apertura");

export const listDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("deposit_accounts").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...values } = data;
    const query = id
      ? context.supabase.from("deposit_accounts").update(values).eq("id", id).eq("user_id", context.userId)
      : context.supabase.from("deposit_accounts").insert({ ...values, user_id: context.userId });
    const { data: saved, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const removeDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("deposit_accounts").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });