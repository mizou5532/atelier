// Client GitHub en lecture seule.
export type DepotGithub = {
  id: number; name: string; full_name: string; html_url: string; homepage: string | null;
  private: boolean; archived: boolean; default_branch: string; pushed_at: string | null; created_at?: string; fork?: boolean;
};

export class ErreurGithub extends Error {
  constructor(public type: "injoignable" | "cle_refusee", message: string) { super(message); }
}

const API = "https://api.github.com";

async function appeler(cle: string, chemin: string, f: typeof fetch, accept = "application/vnd.github+json"): Promise<Response> {
  let r: Response;
  try {
    r = await f(`${API}${chemin}`, {
      headers: { Authorization: `Bearer ${cle}`, Accept: accept, "User-Agent": "atelier", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new ErreurGithub("injoignable", String(e));
  }
  if (r.status === 401 || r.status === 403) throw new ErreurGithub("cle_refusee", `GitHub ${r.status}`);
  return r;
}

export async function listerDepots(cle: string, f: typeof fetch = fetch): Promise<DepotGithub[]> {
  const tous: DepotGithub[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await appeler(cle, `/user/repos?affiliation=owner&per_page=100&page=${page}`, f);
    if (!r.ok) throw new ErreurGithub("injoignable", `GitHub ${r.status}`);
    const lot = (await r.json()) as DepotGithub[];
    tous.push(...lot);
    if (lot.length < 100) break;
  }
  return tous;
}

/** Contenu d'un fichier à la racine du dépôt, ou null s'il est absent. */
export async function lireFichier(cle: string, nomComplet: string, branche: string, chemin: string, f: typeof fetch = fetch): Promise<string | null> {
  const r = await appeler(cle, `/repos/${nomComplet}/contents/${chemin}?ref=${encodeURIComponent(branche)}`, f, "application/vnd.github.raw+json");
  if (r.status === 404) return null;
  if (!r.ok) throw new ErreurGithub("injoignable", `GitHub ${r.status}`);
  return r.text();
}

/** Contenu d'ETAT.md sur la branche donnée, ou null si absent. Lève une erreur si GitHub ne répond pas. */
export async function lireEtatMd(cle: string, nomComplet: string, branche: string, f: typeof fetch = fetch): Promise<string | null> {
  const r = await appeler(cle, `/repos/${nomComplet}/contents/ETAT.md?ref=${encodeURIComponent(branche)}`, f, "application/vnd.github.raw+json");
  if (r.status === 404) return null;
  if (!r.ok) throw new ErreurGithub("injoignable", `GitHub ${r.status}`);
  return r.text();
}

export async function derniersCommits(cle: string, nomComplet: string, branche: string, f: typeof fetch = fetch): Promise<{ date: string; message: string }[]> {
  const r = await appeler(cle, `/repos/${nomComplet}/commits?per_page=5&sha=${encodeURIComponent(branche)}`, f);
  if (r.status === 409 || r.status === 404) return []; // dépôt vide
  if (!r.ok) throw new ErreurGithub("injoignable", `GitHub ${r.status}`);
  const lot = (await r.json()) as { commit: { message: string; author?: { date?: string } } }[];
  return lot.slice(0, 5).map((c) => ({ date: c.commit.author?.date ?? "", message: c.commit.message.split("\n")[0] }));
}

export type Execution = { etat: "succes" | "echec" | "en_cours"; nom: string; quand: string; url: string };

/** Dernière exécution GitHub Actions sur la branche. null si aucune, ou si la clé n'a pas la permission Actions (jamais une erreur de clé). */
export async function derniereExecution(cle: string, nomComplet: string, branche: string, f: typeof fetch = fetch): Promise<Execution | null> {
  let r: Response;
  try {
    r = await f(`${API}/repos/${nomComplet}/actions/runs?per_page=1&branch=${encodeURIComponent(branche)}`, {
      headers: { Authorization: `Bearer ${cle}`, Accept: "application/vnd.github+json", "User-Agent": "atelier", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!r.ok) return null;
  const corps = (await r.json()) as { workflow_runs?: { name: string; status: string; conclusion: string | null; updated_at: string; html_url: string }[] };
  const x = corps.workflow_runs?.[0];
  if (!x) return null;
  const etat = x.status !== "completed" ? "en_cours" : x.conclusion === "success" || x.conclusion === "skipped" ? "succes" : "echec";
  return { etat, nom: x.name, quand: x.updated_at, url: x.html_url };
}

/** Activité des 52 dernières semaines. "calcul" si GitHub prépare encore la réponse (202). */
export async function activiteAnnuelle(cle: string, nomComplet: string, f: typeof fetch = fetch): Promise<{ week: number; days: number[] }[] | "calcul" | null> {
  try {
    const r = await appeler(cle, `/repos/${nomComplet}/stats/commit_activity`, f);
    if (r.status === 202) return "calcul";
    if (r.status !== 200) return null; // 204 = dépôt vide
    const corps = await r.json();
    return Array.isArray(corps) ? (corps as { week: number; days: number[] }[]) : null;
  } catch {
    return null;
  }
}

/** Heures des commits depuis une date (au plus 100). */
export async function commitsDepuis(cle: string, nomComplet: string, branche: string, depuis: string, f: typeof fetch = fetch): Promise<string[]> {
  try {
    const r = await appeler(cle, `/repos/${nomComplet}/commits?per_page=100&sha=${encodeURIComponent(branche)}&since=${encodeURIComponent(depuis)}`, f);
    if (r.status !== 200) return [];
    const lot = (await r.json()) as { commit: { author?: { date?: string } } }[];
    return lot.map((c) => c.commit.author?.date).filter((d): d is string => Boolean(d));
  } catch {
    return [];
  }
}

export type CommitGithub = { sha: string; quand: string; message: string; courriel: string };

/** Une page (100) de commits de la branche, entre deux dates facultatives. null si GitHub ne répond pas; [] si dépôt vide. */
export async function listerCommits(cle: string, nomComplet: string, branche: string, o: { depuis?: string; jusqua?: string; page?: number }, f: typeof fetch = fetch): Promise<CommitGithub[] | null> {
  const q = new URLSearchParams({ per_page: "100", sha: branche, page: String(o.page ?? 1) });
  if (o.depuis) q.set("since", o.depuis);
  if (o.jusqua) q.set("until", o.jusqua);
  try {
    const r = await appeler(cle, `/repos/${nomComplet}/commits?${q}`, f);
    if (r.status === 409 || r.status === 404) return [];
    if (r.status !== 200) return null;
    const lot = (await r.json()) as { sha: string; commit: { message: string; author?: { date?: string; email?: string } } }[];
    return lot.filter((c) => c.commit.author?.date).map((c) => ({ sha: c.sha, quand: c.commit.author!.date!, message: c.commit.message, courriel: c.commit.author?.email ?? "" }));
  } catch {
    return null;
  }
}

export type FichierArbre = { chemin: string; taille: number };

/** Liste de tous les fichiers du dépôt (sans node_modules). null si GitHub ne répond pas. */
export async function arbre(cle: string, nomComplet: string, branche: string, f: typeof fetch = fetch): Promise<FichierArbre[] | null> {
  try {
    const r = await appeler(cle, `/repos/${nomComplet}/git/trees/${encodeURIComponent(branche)}?recursive=1`, f);
    if (r.status === 409) return []; // dépôt vide
    if (!r.ok) return null;
    const corps = (await r.json()) as { tree?: { path: string; type: string; size?: number }[] };
    return (corps.tree ?? [])
      .filter((x) => x.type === "blob" && !/(^|\/)(node_modules|\.git|dist|build|coverage|vendor)\//.test(x.path))
      .map((x) => ({ chemin: x.path, taille: x.size ?? 0 }));
  } catch (e) {
    if (e instanceof ErreurGithub && e.type === "cle_refusee") throw e;
    return null;
  }
}

/** Octets d'un fichier du dépôt (image), ou null. */
export async function lireBinaire(cle: string, nomComplet: string, branche: string, chemin: string, f: typeof fetch = fetch): Promise<ArrayBuffer | null> {
  try {
    const r = await appeler(cle, `/repos/${nomComplet}/contents/${chemin.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branche)}`, f, "application/vnd.github.raw+json");
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Texte d'un fichier du dépôt (n'importe quel dossier), ou null. Jamais d'erreur. */
export async function lireTexte(cle: string, nomComplet: string, branche: string, chemin: string, f: typeof fetch = fetch): Promise<string | null> {
  const o = await lireBinaire(cle, nomComplet, branche, chemin, f);
  return o ? new TextDecoder().decode(o) : null;
}

/** Adresses publiées par les mises en ligne (Vercel, Netlify, Cloudflare Pages…) via GitHub. null si la clé n'a pas la permission. */
export async function adressesDeploiements(cle: string, nomComplet: string, f: typeof fetch = fetch): Promise<string[]> {
  const entetes = { Authorization: `Bearer ${cle}`, Accept: "application/vnd.github+json", "User-Agent": "atelier", "X-GitHub-Api-Version": "2022-11-28" };
  try {
    const r = await f(`${API}/repos/${nomComplet}/deployments?per_page=10`, { headers: entetes, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return [];
    const liste = (await r.json()) as { id: number; environment?: string; production_environment?: boolean }[];
    const prod = liste.filter((d) => d.production_environment || /prod/i.test(d.environment ?? "")).slice(0, 2);
    const adresses: string[] = [];
    for (const d of prod.length ? prod : liste.slice(0, 1)) {
      const s = await f(`${API}/repos/${nomComplet}/deployments/${d.id}/statuses?per_page=5`, { headers: entetes, signal: AbortSignal.timeout(15_000) });
      if (!s.ok) continue;
      const statuts = (await s.json()) as { state: string; environment_url?: string }[];
      const bon = statuts.find((x) => x.state === "success" && x.environment_url);
      if (bon?.environment_url) adresses.push(bon.environment_url);
    }
    return adresses;
  } catch {
    return [];
  }
}
