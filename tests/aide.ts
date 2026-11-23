import { env } from "cloudflare:workers";
import { creerApp } from "../worker/index";
import type { Env } from "../worker/bd";

const EQUIPE = "https://equipe-test.cloudflareaccess.com";
let paire: CryptoKeyPair | undefined;
let jwk: (JsonWebKey & { kid?: string }) | undefined;

function b64url(data: ArrayBuffer | string): string {
  const octets = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function cles() {
  if (!paire) {
    paire = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"],
    )) as CryptoKeyPair;
    jwk = { ...((await crypto.subtle.exportKey("jwk", paire.publicKey)) as JsonWebKey), kid: "k1" };
  }
  return { paire, jwk: jwk! };
}

export async function jeton(charge: Record<string, unknown>): Promise<string> {
  const { paire } = await cles();
  const entete = b64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const t = Math.floor(Date.now() / 1000);
  const corps = b64url(JSON.stringify({ iss: EQUIPE, aud: ["aud-test"], exp: t + 600, nbf: t - 10, ...charge }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", paire.privateKey, new TextEncoder().encode(`${entete}.${corps}`));
  return `${entete}.${corps}.${b64url(sig)}`;
}

export const envTest = env as unknown as Env;

/** Appelle l'API comme le propriétaire (ou avec l'identité donnée). */
export async function api(chemin: string, init: { method?: string; corps?: unknown; charge?: Record<string, unknown>; env?: object } = {}) {
  const { jwk } = await cles();
  const app = creerApp({ certificats: async () => [jwk] });
  const headers: Record<string, string> = { "cf-access-jwt-assertion": await jeton(init.charge ?? { email: "proprio@exemple.ca" }) };
  if (init.corps !== undefined) headers["content-type"] = "application/json";
  return app.request(`https://atelier.exemple.workers.dev${chemin}`, {
    method: init.method ?? "GET", headers, body: init.corps === undefined ? undefined : JSON.stringify(init.corps),
  }, init.env ?? env);
}
