import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { creerApp } from "../worker/index";

const EQUIPE = "https://equipe-test.cloudflareaccess.com";
let cle: CryptoKeyPair;
let jwk: JsonWebKey & { kid?: string };

function b64url(data: ArrayBuffer | string): string {
  const octets = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function jeton(charge: Record<string, unknown>): Promise<string> {
  const entete = b64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = b64url(JSON.stringify({ iss: EQUIPE, aud: ["aud-test"], exp: maintenant + 600, nbf: maintenant - 10, ...charge }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle.privateKey, new TextEncoder().encode(`${entete}.${corps}`));
  return `${entete}.${corps}.${b64url(sig)}`;
}

beforeAll(async () => {
  cle = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  jwk = { ...((await crypto.subtle.exportKey("jwk", cle.publicKey)) as JsonWebKey), kid: "k1" };
});

const app = () => creerApp({ certificats: async () => [jwk] });
const appeler = (chemin: string, init: RequestInit = {}, e: object = env) =>
  app().request(`https://atelier.exemple.workers.dev${chemin}`, init, e);

describe("garde d'accès", () => {
  it("refuse sans jeton", async () => {
    expect((await appeler("/api/sante")).status).toBe(403);
  });

  it("refuse une autre audience", async () => {
    const j = await jeton({ aud: ["autre"], email: "proprio@exemple.ca" });
    expect((await appeler("/api/sante", { headers: { "cf-access-jwt-assertion": j } })).status).toBe(403);
  });

  it("accepte le propriétaire", async () => {
    const j = await jeton({ email: "proprio@exemple.ca" });
    const r = await appeler("/api/sante", { headers: { "cf-access-jwt-assertion": j } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("refuse un autre courriel", async () => {
    const j = await jeton({ email: "intrus@exemple.ca" });
    expect((await appeler("/api/sante", { headers: { "cf-access-jwt-assertion": j } })).status).toBe(403);
  });

  it("jeton de service limité à l'entrée des quotas", async () => {
    const j = await jeton({ common_name: "service-test.access" });
    const h = { "cf-access-jwt-assertion": j, "content-type": "application/json" };
    const quotas = await appeler("/api/quotas/claude", { method: "POST", headers: h, body: "{}" });
    expect(quotas.status).not.toBe(403);
    expect((await appeler("/api/sante", { headers: h })).status).toBe(403);
  });

  it("refuse tout si l'accès privé n'est pas configuré", async () => {
    const j = await jeton({ email: "proprio@exemple.ca" });
    const r = await appeler("/api/sante", { headers: { "cf-access-jwt-assertion": j } }, { ...env, ACCES_EQUIPE: "" });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { message: string }).message).toContain("Accès privé non configuré");
  });
});
