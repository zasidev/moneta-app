// GoCardless Bank Account Data (ex Nordigen) API client. Server-only.
const BASE = "https://bankaccountdata.gocardless.com/api/v2";

export const SANDBOX_INSTITUTION_ID = "SANDBOXFINANCE_SFIN0000";

// Cache del token d'accesso per evitare di chiamare /token/new/ ad ogni richiesta.
// GoCardless rilascia access token validi circa 1 ora (access_expires in secondi).
type CachedToken = { access: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
const TOKEN_MARGIN_MS = 60_000; // rinnova 1 minuto prima della scadenza

async function fetchAccessToken(): Promise<CachedToken> {
  const secret_id = process.env["GOCARDLESS_SECRET_ID"];
  const secret_key = process.env["GOCARDLESS_SECRET_KEY"];
  if (!secret_id || !secret_key) {
    throw new Error(
      "Chiavi GoCardless mancanti: aggiungi GOCARDLESS_SECRET_ID e GOCARDLESS_SECRET_KEY nei segreti del progetto.",
    );
  }
  const res = await fetch(`${BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ secret_id, secret_key }),
  });
  if (!res.ok) throw new Error(`GoCardless token [${res.status}]: ${await res.text()}`);
  const body = (await res.json()) as { access: string; access_expires?: number };
  const ttl = body.access_expires ?? 3600;
  return { access: body.access, expiresAt: Date.now() + ttl * 1000 };
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > TOKEN_MARGIN_MS) {
    return cachedToken.access;
  }
  cachedToken = await fetchAccessToken();
  return cachedToken.access;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gc<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
  attempt = 0,
): Promise<T> {
  const MAX_ATTEMPTS = 4;
  const token = init.token ?? (await getAccessToken());
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (res.ok) {
    return (await res.json()) as T;
  }
  const body = await res.text();
  // Retry con backoff esponenziale su rate limit (429) e errori server (5xx).
  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    const retryAfter = res.headers.get("retry-after");
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : Math.min(1000 * 2 ** attempt, 8000);
    await sleep(delay > 0 ? delay : 1000);
    // Se era un 429, il token potrebbe essere stato invalidato: svuota la cache e riprova.
    if (res.status === 429) cachedToken = null;
    return gc<T>(path, init, attempt + 1);
  }
  console.error(`GoCardless ${path} [${res.status}]: ${body}`);
  throw new Error(`GoCardless ${path} [${res.status}]: ${body}`);
}

export { getAccessToken };
