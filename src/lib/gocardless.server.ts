// GoCardless Bank Account Data (ex Nordigen) API client. Server-only.
const BASE = "https://bankaccountdata.gocardless.com/api/v2";

export const SANDBOX_INSTITUTION_ID = "SANDBOXFINANCE_SFIN0000";

async function getAccessToken(): Promise<string> {
  const secret_id = process.env["GOCARDLESS_SECRET_ID"];
  const secret_key = process.env["GOCARDLESS_SECRET_KEY"];
  if (!secret_id || !secret_key) {
    throw new Error("Chiavi GoCardless mancanti: aggiungi GOCARDLESS_SECRET_ID e GOCARDLESS_SECRET_KEY nei segreti del progetto.");
  }
  const res = await fetch(`${BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ secret_id, secret_key }),
  });
  if (!res.ok) throw new Error(`GoCardless token [${res.status}]: ${await res.text()}`);
  return ((await res.json()) as { access: string }).access;
}

export async function gc<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const token = init.token ?? (await getAccessToken());
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`GoCardless ${path} [${res.status}]: ${body}`);
    throw new Error(`GoCardless ${path} [${res.status}]: ${body}`);
  }
  return (await res.json()) as T;
}

export { getAccessToken };
