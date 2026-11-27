import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { eb } from "./enablebanking.server";

type Institution = { id: string; name: string; logo: string };

export const listInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const list = await eb<{ aspsps: unknown[] }>("/aspsps?country=IT");
    return list.aspsps.map((a: any) => ({
      id: a.name,
      name: a.name,
      logo: a.logo ?? "",
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
    const auth = await eb<{ url: string; authorization_id: string }>("/auth", {
      method: "POST",
      body: {
        access: { valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
        aspsp: { name: data.institutionName, country: "IT" },
        state: reference,
        redirect_url: data.redirectUrl,
        psu_type: "personal",
      },
    });
    const { error } = await context.supabase.from("bank_requisitions").insert({
      user_id: context.userId,
      requisition_id: auth.authorization_id,
      reference,
      institution_id: data.institutionName,
      institution_name: data.institutionName,
      status: "CR",
    });
    if (error) throw new Error(error.message);
    return { link: auth.url };
  });

export const completeBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; state: string }) => {
    if (!d?.code || !d?.state) throw new Error("Dati non validi");
    return d;
  })
  .handler(async ({ data, context }) => {
    const session = await eb<{ session_id: string; accounts: unknown[] }>("/sessions", {
      method: "POST",
      body: { code: data.code },
    });
    const { error } = await context.supabase
      .from("bank_requisitions")
      .update({ session_id: session.session_id, status: "LN" })
      .eq("reference", data.state)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { sessionId: session.session_id };
  });

export const syncBankData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: reqs, error } = await supabase.from("bank_requisitions").select("*");
    if (error) throw new Error(error.message);
    let accountsSynced = 0;
    let txSynced = 0;
    const errors: string[] = [];

    for (const r of reqs ?? []) {
      try {
        if (!r.session_id) {
          errors.push(
            `${r.institution_name ?? r.institution_id}: sessione non ancora autorizzata, completa il collegamento`,
          );
          continue;
        }

        const session = await eb<{ accounts_data: unknown[] }>(`/sessions/${r.session_id}`);
        const accounts = session.accounts_data ?? [];

        for (const acc of accounts) {
          const accId = (acc as any).uid;
          const [details, balances, txs] = await Promise.all([
            eb<any>(`/accounts/${accId}/details`),
            eb<any>(`/accounts/${accId}/balances`),
            eb<any>(`/accounts/${accId}/transactions`),
          ]);

          const bal = balances.balances?.[0];
          const { data: accRow, error: accErr } = await supabase
            .from("bank_accounts")
            .upsert(
              {
                user_id: userId,
                requisition_id: r.id,
                eb_account_id: accId,
                iban: details.account_id?.iban ?? null,
                name: details.name ?? r.institution_name,
                currency: details.currency ?? bal?.balance_amount?.currency ?? null,
                balance: bal ? Number(bal.balance_amount.amount) : null,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "eb_account_id" },
            )
            .select("id")
            .single();
          if (accErr) throw new Error(accErr.message);
          accountsSynced++;

          const rows = (txs.transactions ?? []).map((t: any) => ({
            user_id: userId,
            account_id: accRow.id,
            eb_transaction_id: t.transaction_id ?? t.entry_reference ?? `${t.booking_date}-${t.transaction_amount?.amount}-${Math.random()}`,
            booking_date: t.booking_date ?? t.value_date ?? null,
            amount: t.credit_debit_indicator === "DBIT" ? -Number(t.transaction_amount.amount) : Number(t.transaction_amount.amount),
            currency: t.transaction_amount.currency,
            description: t.remittance_information?.join(" ") ?? t.reference_number ?? null,
            counterparty: t.creditor?.name ?? t.debtor?.name ?? null,
          }));
          if (rows.length) {
            const { error: txErr } = await supabase
              .from("bank_transactions")
              .upsert(rows, { onConflict: "account_id,eb_transaction_id" });
            if (txErr) throw new Error(txErr.message);
            txSynced += rows.length;
          }
        }
      } catch (e) {
        errors.push(
          `${r.institution_name ?? r.institution_id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return { accountsSynced, txSynced, errors };
  });
