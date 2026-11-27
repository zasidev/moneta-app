import { serve } from "https://deno.land/std@0.174.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(pemContents);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function makeJwt(appId: string, privateKeyPem: string, ttlSeconds = 3600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId })));
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + ttlSeconds })),
  );
  const signingInput = new TextEncoder().encode(`${header}.${body}`);
  const key = await importPrivateKey(privateKeyPem);
  const signatureBuffer = new ArrayBuffer(signingInput.length);
  const signatureView = new Uint8Array(signatureBuffer);
  signatureView.set(signingInput);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signatureBuffer);
  return `${header}.${body}.${b64url(new Uint8Array(signature))}`;
}

async function getToken(): Promise<string> {
  const appId = Deno.env.get("ENABLE_BANKING_APP_ID");
  const privateKey = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY");
  if (!appId || !privateKey) {
    throw new Error("Credenziali Enable Banking non configurate sulle edge function");
  }
  return makeJwt(appId, privateKey, 3600);
}

async function ebFetch(path: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`https://api.enablebanking.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Enable Banking ${path} [${res.status}]: ${text}`);
  }
  return res.json();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variabili Supabase mancanti sull'edge function");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: reqs, error: reqsErr } = await supabase.from("bank_requisitions").select("*");
    if (reqsErr) throw new Error(reqsErr.message);

    let accountsSynced = 0;
    let txSynced = 0;
    const errors: string[] = [];

    for (const r of reqs ?? []) {
      try {
        if (!r.session_id) {
          errors.push(`${r.institution_name ?? r.institution_id}: sessione non ancora autorizzata`);
          continue;
        }

        const session = await ebFetch<{ accounts_data: unknown[] }>(`/sessions/${r.session_id}`);
        const accounts = session.accounts_data ?? [];

        for (const acc of accounts) {
          const accId = (acc as any).uid;
          const [details, balances, txs] = await Promise.all([
            ebFetch(`/accounts/${accId}/details`),
            ebFetch(`/accounts/${accId}/balances`),
            ebFetch(`/accounts/${accId}/transactions`),
          ]);

          const bal = (balances as any).balances?.[0];
          const { data: accRow, error: accErr } = await supabase
            .from("bank_accounts")
            .upsert(
              {
                requisition_id: r.id,
                eb_account_id: accId,
                iban: (details as any).account_id?.iban ?? null,
                name: (details as any).name ?? r.institution_name,
                currency: (details as any).currency ?? bal?.balance_amount?.currency ?? null,
                balance: bal ? Number(bal.balance_amount.amount) : null,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "eb_account_id" },
            )
            .select("id")
            .single();
          if (accErr) throw new Error(accErr.message);
          accountsSynced++;

          const rows = ((txs as any).transactions ?? []).map((t: any) => ({
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

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        errors.push(`${r.institution_name ?? r.institution_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ accountsSynced, txSynced, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
