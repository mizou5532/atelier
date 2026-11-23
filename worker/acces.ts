// Vérifie le jeton que Cloudflare Access ajoute à chaque requête
// (en-tête Cf-Access-Jwt-Assertion, signature RS256). Même principe que Pistes.

export type ConfigAcces = { equipe: string; aud: string };
export type ChercherCertificats = (equipe: string) => Promise<(JsonWebKey & { kid?: string })[]>;
export type Verdict = { ok: true; courriel?: string; service?: string } | { ok: false; raison: string };

export const certificatsAccess: ChercherCertificats = async (equipe) => {
  const r = await fetch(`${equipe}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`certs ${r.status}`);
  const corps = (await r.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  return corps.keys ?? [];
};

function decoder(partie: string): Uint8Array {
  const b64 = partie.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(partie.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function verifierJetonAcces(
  jeton: string | undefined,
  config: ConfigAcces,
  certificats: ChercherCertificats = certificatsAccess,
): Promise<Verdict> {
  if (!jeton) return { ok: false, raison: "jeton absent" };
  const parties = jeton.split(".");
  if (parties.length !== 3) return { ok: false, raison: "jeton mal formé" };
  let entete: { alg?: string; kid?: string };
  let charge: { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string; common_name?: string };
  try {
    entete = JSON.parse(new TextDecoder().decode(decoder(parties[0])));
    charge = JSON.parse(new TextDecoder().decode(decoder(parties[1])));
  } catch {
    return { ok: false, raison: "jeton illisible" };
  }
  if (entete.alg !== "RS256") return { ok: false, raison: "algorithme inattendu" };
  const cles = await certificats(config.equipe);
  const jwk = cles.find((k) => k.kid === entete.kid);
  if (!jwk) return { ok: false, raison: "clé inconnue" };
  const cle = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valide = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cle,
    decoder(parties[2]),
    new TextEncoder().encode(`${parties[0]}.${parties[1]}`),
  );
  if (!valide) return { ok: false, raison: "signature invalide" };
  const maintenant = Math.floor(Date.now() / 1000);
  if (charge.iss !== config.equipe) return { ok: false, raison: "émetteur inattendu" };
  const auds = Array.isArray(charge.aud) ? charge.aud : [charge.aud];
  if (!auds.includes(config.aud)) return { ok: false, raison: "audience inattendue" };
  if (typeof charge.exp !== "number" || charge.exp < maintenant) return { ok: false, raison: "jeton expiré" };
  if (typeof charge.nbf === "number" && charge.nbf > maintenant + 60) return { ok: false, raison: "jeton pas encore valide" };
  return { ok: true, courriel: charge.email, service: charge.common_name };
}
