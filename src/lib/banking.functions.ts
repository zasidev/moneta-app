import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Institution = { id: string; name: string; logo: string };

async function invokeFunction(name: string, body?: unknown): Promise<any> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await (supabase.functions.invoke as any)(name, { body });
  if (error) throw error;
  return data as any;
}

export const listInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = await invokeFunction("enablebanking-institutions");
    return (data.institutions ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      logo: i.logo,
    }));
  });

export const startBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { institutionName: string; redirectUrl: string }) => {
    if (!d?.institutionName || !/^https?:\/\//.test(d.redirectUrl))
      throw new Error("Dati non validi");
    return d;
  })
  .handler(async ({ data, context }) => {
    const reference = crypto.randomUUID();
    const result = await invokeFunction("enablebanking-auth", {
      institutionName: data.institutionName,
      redirectUrl: data.redirectUrl,
      state: reference,
    });
    const { error } = await context.supabase.from("bank_requisitions").insert({
      user_id: context.userId,
      requisition_id: result.authorization_id,
      reference,
      institution_id: data.institutionName,
      institution_name: data.institutionName,
      status: "CR",
    });
    if (error) throw new Error(error.message);
    return { link: result.url };
  });

export const completeBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; state: string }) => {
    if (!d?.code || !d?.state) throw new Error("Dati non validi");
    return d;
  })
  .handler(async ({ data, context }) => {
    await invokeFunction("enablebanking-callback", { code: data.code, state: data.state });
    const { error } = await context.supabase
      .from("bank_requisitions")
      .update({ status: "LN" })
      .eq("reference", data.state)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncBankData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await invokeFunction("enablebanking-sync");
    return {
      accountsSynced: data.accountsSynced ?? 0,
      txSynced: data.txSynced ?? 0,
      errors: data.errors ?? [],
    };
  });
