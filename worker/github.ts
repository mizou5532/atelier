// Client GitHub en lecture seule.
export type DepotGithub = {
  id: number; name: string; full_name: string; html_url: string; homepage: string | null;
  private: boolean; archived: boolean; default_branch: string; pushed_at: string | null; created_at?: string;
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
