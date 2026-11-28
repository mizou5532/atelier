// Découverte : à chaque changement poussé, l'agent va chercher tout seul le logo, le vrai nom et le site de chaque projet.
// Lecture seule : il lit GitHub et les sites publics, il n'écrit jamais dans les dépôts.
import type { DepotBrut, Env, ProjetBrut } from "./bd";
import { lireReglage } from "./bd";
import { adressesDeploiements, arbre, lireBinaire, lireTexte, type FichierArbre } from "./github";
import { dessinerLogo } from "./agent";
import { depotPrincipal } from "./vue";

const TAILLE_MAX_IMAGE = 300_000;
const PROJETS_PAR_PASSAGE = 2;
const DOSSIERS_IGNORES = /(^|\/)(tests?|__tests__|e2e|fixtures|exemples?|examples?|\.github|docs)\//i;
const DOSSIERS_PUBLICS = /(^|\/)(public|static|assets|app|web|www|site)\//i;

// ---------- Petits outils purs (testés un par un) ----------

/** « calendrier-thermique » → « Calendrier thermique ». */
export function nomLisible(depot: string): string {
  const s = depot.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : depot;
}

/** JSON avec commentaires et virgules finales (wrangler.jsonc, manifestes), ou null. */
export function lireJsonc(texte: string | null): Record<string, unknown> | null {
  if (!texte) return null;
  let sortie = "";
  let dansChaine = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansChaine) {
      sortie += c;
      if (c === "\\") { sortie += texte[++i] ?? ""; continue; }
      if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') { dansChaine = true; sortie += c; continue; }
    if (c === "/" && texte[i + 1] === "/") { while (i < texte.length && texte[i] !== "\n") i++; sortie += "\n"; continue; }
    if (c === "/" && texte[i + 1] === "*") { i += 2; while (i < texte.length && !(texte[i] === "*" && texte[i + 1] === "/")) i++; i++; continue; }
    sortie += c;
  }
  try {
    const v = JSON.parse(sortie.replace(/,(\s*[}\]])/g, "$1"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const https = (hote: string) => `https://${hote.replace(/^https?:\/\//, "").replace(/\/\*?$/, "")}`;

/** Adresses possibles d'un projet Cloudflare d'après son fichier wrangler (domaines, routes, pages.dev, workers.dev). */
export function adressesWrangler(texte: string, fichier: string, sousDomaine: string): string[] {
  let nom: string | undefined; let workersDev = true; let pages = false; const routes: string[] = [];
  if (/\.toml$/i.test(fichier)) {
    nom = texte.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
    workersDev = !/^\s*workers_dev\s*=\s*false/m.test(texte);
    pages = /^\s*pages_build_output_dir\s*=/m.test(texte);
    for (const m of texte.matchAll(/^\s*(?:pattern|route)\s*=\s*["']([^"']+)["']/gm)) routes.push(m[1]);
  } else {
    const j = lireJsonc(texte);
    if (!j) return [];
    nom = typeof j.name === "string" ? j.name : undefined;
    workersDev = j.workers_dev !== false;
    pages = typeof j.pages_build_output_dir === "string";
    const brutes = [...(Array.isArray(j.routes) ? j.routes : []), ...(j.route ? [j.route] : [])];
    for (const r of brutes) {
      if (typeof r === "string") routes.push(r);
      else if (r && typeof r === "object" && typeof (r as { pattern?: unknown }).pattern === "string") routes.push((r as { pattern: string }).pattern);
    }
  }
  const sortie = routes.filter((r) => !r.includes("*") || /\/\*$/.test(r)).map(https);
  if (nom && pages) sortie.push(`https://${nom}.pages.dev`);
  if (nom && !pages && workersDev && sousDomaine) sortie.push(`https://${nom}.${sousDomaine}.workers.dev`);
  return sortie;
}

const HEBERGEURS = /https?:\/\/[a-z0-9][a-z0-9.-]*\.(?:workers\.dev|pages\.dev|vercel\.app|netlify\.app|github\.io|onrender\.com|fly\.dev|web\.app|firebaseapp\.com)(?:\/[^\s)"'`<>\]]*)?/gi;

/** Adresses d'hébergeurs connus citées dans un texte. */
export function adressesDansTexte(texte: string): string[] {
  return [...new Set([...texte.matchAll(HEBERGEURS)].map((m) => m[0].replace(/[.,;:!?]+$/, "")))];
}

/** Garde seulement les adresses dont le nom ressemble au projet (évite les liens vers d'autres projets cités dans les documents). */
export function ressemble(url: string, noms: string[]): boolean {
  const hote = url.replace(/^https?:\/\//, "").split(/[/.]/)[0].toLowerCase();
  const mots = noms.flatMap((n) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/)).filter((m) => m.length >= 4);
  return mots.some((m) => hote.includes(m));
}

export function typeImage(chemin: string): string | null {
  const ext = chemin.split("?")[0].toLowerCase().match(/\.(png|svg|ico|webp|jpe?g)$/)?.[1];
  const types: Record<string, string> = { png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
  return ext ? types[ext] ?? null : null;
}

export function versDataUrl(octets: ArrayBuffer, type: string): string {
  const u = new Uint8Array(octets);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}

const fiable = (f: FichierArbre) => !DOSSIERS_IGNORES.test(f.chemin) && f.taille > 0 && f.taille <= TAILLE_MAX_IMAGE;
const preferePublic = (a: string, b: string) => Number(DOSSIERS_PUBLICS.test(b)) - Number(DOSSIERS_PUBLICS.test(a)) || a.split("/").length - b.split("/").length || a.length - b.length;

export function manifestes(liste: FichierArbre[]): string[] {
  return liste.filter((f) => !DOSSIERS_IGNORES.test(f.chemin) && /(^|\/)(manifest\.webmanifest|site\.webmanifest|manifest\.json)$/i.test(f.chemin))
    .map((f) => f.chemin).sort(preferePublic);
}

/** Meilleure icône d'un manifeste d'app (proche de 192 px, pas « masquable » seule), retrouvée dans le dépôt. */
export function iconeDuManifeste(manifeste: Record<string, unknown>, cheminManifeste: string, liste: FichierArbre[]): string | null {
  const icones = (Array.isArray(manifeste.icons) ? manifeste.icons : []) as { src?: unknown; sizes?: unknown; purpose?: unknown }[];
  const bonnes = icones.filter((i) => typeof i.src === "string" && typeImage(i.src) && (typeof i.purpose !== "string" || /\bany\b/.test(i.purpose) || !/maskable|monochrome/.test(i.purpose)));
  const taille = (i: { sizes?: unknown; src?: unknown }) => /\.svg$/i.test(String(i.src)) ? 192 : Number(String(i.sizes ?? "").match(/(\d+)/)?.[1] ?? 0);
  bonnes.sort((a, b) => Math.abs(taille(a) - 192) - Math.abs(taille(b) - 192));
  const dossier = cheminManifeste.includes("/") ? cheminManifeste.slice(0, cheminManifeste.lastIndexOf("/") + 1) : "";
  for (const i of bonnes) {
    const src = String(i.src).split("?")[0].replace(/^\.?\//, "");
    const exact = liste.find((f) => f.chemin === dossier + src && fiable(f));
    if (exact) return exact.chemin;
    const proche = liste.filter((f) => (f.chemin === src || f.chemin.endsWith(`/${src}`)) && fiable(f)).map((f) => f.chemin).sort(preferePublic)[0];
    if (proche) return proche;
  }
  return null;
}

const NOMS_ICONES = [
  /(^|\/)apple-touch-icon[^/]*\.png$/i,
  /(^|\/)(logo|icon|icone)\.svg$/i,
  /(^|\/)(logo|icon|icone)[-_]?(192|180|256|512)?(x\d+)?\.png$/i,
  /(^|\/)(logo|icon|icone)[^/]*\.(svg|png|webp)$/i,
  /(^|\/)favicon\.(svg|png)$/i,
  /(^|\/)favicon\.ico$/i,
];

/** Icône trouvée d'après le nom des fichiers (logo.svg, apple-touch-icon.png, favicon…). */
export function iconeParNom(liste: FichierArbre[]): string | null {
  for (const motif of NOMS_ICONES) {
    const trouve = liste.filter((f) => fiable(f) && motif.test(f.chemin)).map((f) => f.chemin).sort(preferePublic)[0];
    if (trouve) return trouve;
  }
  return null;
}

/** Icônes annoncées par la page d'accueil d'un site, de la meilleure à la moins bonne. */
export function iconesDansHtml(html: string, base: string): string[] {
  const liens: { rel: string; href: string; taille: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const attr = (n: string) => m[0].match(new RegExp(`\\b${n}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    const rel = attr("rel")?.toLowerCase(); const href = attr("href");
    if (!rel || !href || !/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    try { liens.push({ rel, href: new URL(href, base).href, taille: Number(attr("sizes")?.match(/\d+/)?.[0] ?? (/\.svg/i.test(href) ? 192 : 32)) }); } catch { /* adresse illisible */ }
  }
  const rang = (l: { rel: string; href: string }) => (/apple-touch/.test(l.rel) ? 0 : /\.svg/i.test(l.href) ? 1 : 2);
  liens.sort((a, b) => rang(a) - rang(b) || b.taille - a.taille);
  return [...liens.map((l) => l.href), new URL("/favicon.ico", base).href];
}

/** Un site existe s'il répond (même derrière un cadenas : redirection ou 401/403). */
export async function siteRepond(url: string, f: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await f(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "atelier" } });
    return r.status < 400 || r.status === 401 || r.status === 403;
  } catch {
    return false;
  }
}

/** Télécharge une image publique (au plus 300 Ko), ou null. */
async function imageEnLigne(url: string, f: typeof fetch): Promise<string | null> {
  try {
    const r = await f(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "atelier" } });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const sur = type.startsWith("image/") ? type : typeImage(url);
    if (!sur || type.startsWith("text/")) return null;
    const octets = await r.arrayBuffer();
    return octets.byteLength > 0 && octets.byteLength <= TAILLE_MAX_IMAGE ? versDataUrl(octets, sur) : null;
  } catch {
    return null;
  }
}

/** Icône du site en ligne : celles annoncées par la page, sinon /favicon.ico. */
export async function iconeDuSite(site: string, f: typeof fetch = fetch): Promise<string | null> {
  let html = "";
  try {
    const r = await f(site, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "atelier" } });
    const finale = r.url || site;
    if (r.ok && /html/i.test(r.headers.get("content-type") ?? "") && !/cloudflareaccess\.com/.test(finale)) html = (await r.text()).slice(0, 500_000);
    else if (!r.ok || /cloudflareaccess\.com/.test(finale)) return null; // site fermé par un cadenas : rien à lire
  } catch {
    return null;
  }
  for (const url of iconesDansHtml(html, site).slice(0, 4)) {
    const image = await imageEnLigne(url, f);
    if (image) return image;
  }
  return null;
}

// ---------- L'étape de synchronisation ----------

const RANG = { ia: 1, site: 2, projet: 3 } as const;
type Source = keyof typeof RANG;

/** L'agent revoit au plus 2 projets par passage : ceux jamais vus d'abord, puis ceux qui ont changé depuis. */
export async function decouvrir(env: Env, f: typeof fetch = fetch): Promise<void> {
  const db = env.DB;
  const sousDomaine = (await lireReglage(db, "sous_domaine_workers")) ?? "";
  const projets = (await db.prepare("SELECT * FROM projets WHERE masque = 0").all<ProjetBrut>()).results;
  const depots = (await db.prepare("SELECT * FROM depots WHERE projet_id IS NOT NULL AND masque = 0 AND disparu = 0").all<DepotBrut>()).results;
  const aFaire = projets
    .map((p) => ({ p, d: depotPrincipal(p, depots.filter((x) => x.projet_id === p.id)) }))
    .filter(({ p, d }) => d ? p.decouverte_pour !== d.pousse_le : !p.logo && !p.logo_source && Boolean(env.GEMINI_CLE))
    .sort((a, b) => Number(Boolean(a.p.decouverte_pour)) - Number(Boolean(b.p.decouverte_pour)) || (b.d?.pousse_le ?? "").localeCompare(a.d?.pousse_le ?? ""))
    .slice(0, PROJETS_PAR_PASSAGE);
  for (const { p, d } of aFaire) {
    try {
      if (d) await decouvrirProjet(env, p, d, sousDomaine, f);
      else await poserLogo(db, p, await logoIA(env, p.nom, p.notes, f));
    } catch (e) {
      console.error("Découverte impossible pour", p.nom, e);
    }
  }
}

async function logoIA(env: Env, nom: string, description: string, f: typeof fetch): Promise<{ data: string; source: Source } | null> {
  if (!env.GEMINI_CLE) return null;
  const svg = await dessinerLogo(env.GEMINI_CLE, env.GEMINI_MODELE || "gemini-3.5-flash-lite", { nom, description }, f);
  return svg ? { data: versDataUrl(new TextEncoder().encode(svg).buffer as ArrayBuffer, "image/svg+xml"), source: "ia" } : null;
}

async function poserLogo(db: D1Database, p: ProjetBrut, nouveau: { data: string; source: Source } | null): Promise<void> {
  if (!nouveau || p.logo_source === "retire" || nouveau.data === p.logo) return;
  const actuel = p.logo && p.logo_source ? RANG[p.logo_source as Source] ?? 0 : 0;
  if (RANG[nouveau.source] < actuel) return; // on ne remplace jamais un meilleur logo par un moins bon
  await db.prepare("UPDATE projets SET logo = ?, logo_source = ?, logo_maj = ? WHERE id = ?").bind(nouveau.data, nouveau.source, new Date().toISOString(), p.id).run();
  p.logo = nouveau.data; p.logo_source = nouveau.source;
}

async function decouvrirProjet(env: Env, p: ProjetBrut, d: DepotBrut, sousDomaine: string, f: typeof fetch): Promise<void> {
  const db = env.DB; const cle = env.GITHUB_CLE;
  const liste = await arbre(cle, d.nom_complet, d.branche, f);
  if (liste === null) return; // GitHub ne répond pas : on réessaiera au prochain passage
  const existe = (chemin: string) => liste.some((x) => x.chemin === chemin);
  const lire = (chemin: string) => (existe(chemin) ? lireTexte(cle, d.nom_complet, d.branche, chemin, f) : Promise.resolve(null));
  const nomDepot = d.nom_complet.split("/")[1];

  // 1. Manifeste de l'app : vrai nom, description, icône
  let nomTrouve: string | undefined; let description = ""; let icone: string | null = null;
  for (const chemin of manifestes(liste).slice(0, 2)) {
    const m = lireJsonc(await lire(chemin));
    if (!m) continue;
    nomTrouve ??= typeof m.name === "string" && m.name.trim() ? m.name.trim().slice(0, 120) : undefined;
    description ||= typeof m.description === "string" ? m.description : "";
    icone ??= iconeDuManifeste(m, chemin, liste);
  }
  icone ??= iconeParNom(liste);
  const paquet = lireJsonc(await lire("package.json"));
  description ||= typeof paquet?.description === "string" ? paquet.description : "";
  const documents = (await Promise.all(["README.md", "PASSATION.md"].map(lire))).filter(Boolean).join("\n\n");

  // 2. Site en ligne : champ « site » de GitHub, sinon on cherche et on vérifie qu'il répond
  let site = d.site;
  if (!site) {
    const candidats: string[] = [...(await adressesDeploiements(cle, d.nom_complet, f))];
    const wrangler = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].find(existe);
    if (wrangler) candidats.push(...adressesWrangler((await lire(wrangler)) ?? "", wrangler, sousDomaine));
    for (const c of ["CNAME", "public/CNAME", "docs/CNAME"].filter(existe)) {
      const hote = (await lire(c))?.trim().split(/\s+/)[0];
      if (hote) candidats.push(https(hote));
    }
    if (typeof paquet?.homepage === "string" && /^https?:\/\//.test(paquet.homepage)) candidats.push(paquet.homepage);
    candidats.push(...adressesDansTexte(documents).filter((u) => ressemble(u, [nomDepot, p.nom, nomTrouve ?? ""])));
    for (const u of [...new Set(candidats.filter((u) => /^https?:\/\//.test(u)))].slice(0, 6)) {
      if (await siteRepond(u, f)) { site = u; break; }
    }
    await db.prepare("UPDATE depots SET site_trouve = ? WHERE github_id = ?").bind(site ?? null, d.github_id).run();
  }

  // 3. Logo : celui du projet, sinon celui du site, sinon un petit logo dessiné par l'IA
  if ((p.logo_source as string | null | undefined) !== "retire") {
    let nouveau: { data: string; source: Source } | null = null;
    if (icone) {
      const octets = await lireBinaire(cle, d.nom_complet, d.branche, icone, f);
      const type = typeImage(icone);
      if (octets && type && octets.byteLength <= TAILLE_MAX_IMAGE) nouveau = { data: versDataUrl(octets, type), source: "projet" };
    }
    if (!nouveau && site && p.logo_source !== "projet") {
      const image = await iconeDuSite(site, f);
      if (image) nouveau = { data: image, source: "site" };
    }
    if (!nouveau && !p.logo) nouveau = await logoIA(env, nomTrouve ?? p.nom, [description, documents.slice(0, 3000)].filter(Boolean).join("\n\n"), f);
    await poserLogo(db, p, nouveau);
  }

  // 4. Vrai nom, tant que tu n'as pas renommé le projet toi-même
  const ecritures = [db.prepare("UPDATE projets SET decouverte_pour = ? WHERE id = ?").bind(d.pousse_le, p.id)];
  if (p.nom_auto && nomTrouve && nomTrouve !== p.nom) ecritures.push(db.prepare("UPDATE projets SET nom = ? WHERE id = ? AND nom_auto = 1").bind(nomTrouve, p.id));
  await db.batch(ecritures);
}
