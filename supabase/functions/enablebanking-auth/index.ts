import { serve } from "https://deno.land/std@0.174.0/http/server.ts";

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

async function ebAuth(body: unknown): Promise<{ url: string; authorization_id: string }> {
  const token = await getToken();
  const res = await fetch("https://api.enablebanking.com/auth", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Enable Banking /auth [${res.status}]: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { institutionName, redirectUrl, state } = await req.json();
    if (!institutionName || !redirectUrl || !state) {
      throw new Error("Dati non validi");
    }
    const result = await ebAuth({
      access: { valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
      aspsp: { name: institutionName, country: "IT" },
      state,
      redirect_url: redirectUrl,
      psu_type: "personal",
    });
    return new Response(
      JSON.stringify({ url: result.url, authorization_id: result.authorization_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
