import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gc, getAccessToken, SANDBOX_INSTITUTION_ID } from "./gocardless.server";

type Institution = { id: string; name: string; logo: string };

export const listInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const list = await gc<Institution[]>("/institutions/?country=it");
    const sandbox: Institution = {
      id: SANDBOX_INSTITUTION_ID,
      name: "Sandbox Finance (test)",
      logo: "https://cdn-logos.gocardless.com/ais/SANDBOXFINANCE_SFIN0000.png",
    };
    return [sandbox, ...list.filter((i) => i.id !== SANDBOX_INSTITUTION_ID)].map((i) => ({ id: i.id, name: i.name, logo: i.logo }));
  });

export const startBankConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { institutionId: string; institutionName: string; redirectUrl: string }) => {
    if (!d?.institutionId || !/^https?:\/\//.test(d.redirectUrl)) throw new Error("Dati non validi");
    return d;
  })
  .handler(async ({ data, context }) => {
    const token = await getAccessToken();
    const agreement = await gc<{ id: string }>("/agreements/enduser/", {
      method: "POST",
      token,
      body: {
        institution_id: data.institutionId,
        max_historical_days: 90,
        access_valid_for_days: 90,
        access_scope: ["balances", "details", "transactions"],
      },
    });
    const reference = crypto.randomUUID();
    const redirect = new URL(data.redirectUrl);
    redirect.searchParams.set("ref", reference);
    const req = await gc<{ id: string; link: string; status: string }>("/requisitions/", {
      method: "POST",
      token,
      body: {
        redirect: redirect.toString(),
        institution_id: data.institutionId,
        reference,
        agreement: agreement.id,
        user_language: "IT",
      },
    });
    const { error } = await context.supabase.from("bank_requisitions").insert({
      user_id: context.userId,
      requisition_id: req.id,
      reference,
      institution_id: data.institutionId,
      institution_name: data.institutionName,
      status: req.status,
      link: req.link,
    });
    if (error) throw new Error(error.message);
    return { link: req.link };
  });

type GcTx = {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
};

export const syncBankData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: reqs, error } = await supabase.from("bank_requisitions").select("*");
    if (error) throw new Error(error.message);
    const token = await getAccessToken();
    let accountsSynced = 0;
    let txSynced = 0;
    const errors: string[] = [];

    for (const r of reqs ?? []) {
      try {
        let remote: { status: string; accounts: string[] } | null = null;
        let linked = false;
        // GoCardless può impiegare qualche secondo a segnare la requisizione come "LN" dopo il redirect dalla banca
        for (let attempt = 0; attempt < 3; attempt++) {
          remote = await gc<{ status: string; accounts: string[] }>(`/requisitions/${r.requisition_id}/`, { token });
          await supabase.from("bank_requisitions").update({ status: remote.status }).eq("id", r.id);
          if (remote.status === "LN") { linked = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!linked) {
          errors.push(`${r.institution_name ?? r.institution_id}: conto non ancora collegato da GoCardless (stato ${remote?.status ?? "sconosciuto"}), riprova la sincronizzazione`);
          continue;
        }
        if (!remote) continue;

        for (const accId of remote.accounts) {
          const [details, balances, txs] = await Promise.all([
            gc<{ account: { iban?: string; name?: string; ownerName?: string; currency?: string } }>(`/accounts/${accId}/details/`, { token }),
            gc<{ balances: { balanceAmount: { amount: string; currency: string }; balanceType: string }[] }>(`/accounts/${accId}/balances/`, { token }),
            gc<{ transactions: { booked: GcTx[] } }>(`/accounts/${accId}/transactions/`, { token }),
          ]);
          const bal = balances.balances.find((b) => b.balanceType === "interimAvailable") ?? balances.balances[0];
          const { data: acc, error: accErr } = await supabase
            .from("bank_accounts")
            .upsert(
              {
                user_id: userId,
                requisition_id: r.id,
                gc_account_id: accId,
                iban: details.account.iban ?? null,
                name: details.account.name ?? details.account.ownerName ?? r.institution_name,
                currency: details.account.currency ?? bal?.balanceAmount.currency ?? null,
                balance: bal ? Number(bal.balanceAmount.amount) : null,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "gc_account_id" },
            )
            .select("id")
            .single();
          if (accErr) throw new Error(accErr.message);
          accountsSynced++;

          const rows = (txs.transactions.booked ?? []).map((t, i) => ({
            user_id: userId,
            account_id: acc.id,
            gc_transaction_id: t.transactionId ?? t.internalTransactionId ?? `${t.bookingDate}-${t.transactionAmount.amount}-${i}`,
            booking_date: t.bookingDate ?? t.valueDate ?? null,
            amount: Number(t.transactionAmount.amount),
            currency: t.transactionAmount.currency,
            description: t.remittanceInformationUnstructured ?? t.remittanceInformationUnstructuredArray?.join(" ") ?? null,
            counterparty: t.creditorName ?? t.debtorName ?? null,
          }));
          if (rows.length) {
            const { error: txErr } = await supabase
              .from("bank_transactions")
              .upsert(rows, { onConflict: "account_id,gc_transaction_id" });
            if (txErr) throw new Error(txErr.message);
            txSynced += rows.length;
          }
        }
      } catch (e) {
        errors.push(`${r.institution_name ?? r.institution_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { accountsSynced, txSynced, errors };
  });
