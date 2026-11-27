// Enable Banking API client. Server-only.
// Auth: JWT RS256 firmato con chiave privata RSA dell'applicazione.
const BASE = "https://api.enablebanking.com";

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

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

async function getToken(): Promise<string> {
  const appId = process.env["ENABLE_BANKING_APP_ID"];
  const privateKey = process.env["ENABLE_BANKING_PRIVATE_KEY"];
  if (!appId || !privateKey) {
    throw new Error(
      "Chiavi Enable Banking mancanti: aggiungi ENABLE_BANKING_APP_ID e ENABLE_BANKING_PRIVATE_KEY nei segreti del progetto.",
    );
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) return cachedToken.token;
  const token = await makeJwt(appId, privateKey, 3600);
  cachedToken = { token, expiresAt: now + 3600 * 1000 };
  return token;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function eb<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  attempt = 0,
): Promise<T> {
  const MAX_ATTEMPTS = 4;
  const token = await getToken();
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
  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    const retryAfter = res.headers.get("retry-after");
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(1000 * 2 ** attempt, 8000);
    await sleep(delay > 0 ? delay : 1000);
    return eb<T>(path, init, attempt + 1);
  }
  console.error(`Enable Banking ${path} [${res.status}]: ${body}`);
  throw new Error(`Enable Banking ${path} [${res.status}]: ${body}`);
}

export { getToken };
