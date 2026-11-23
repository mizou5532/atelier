import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { resumerDepot } from "../worker/agent";
import { synchroniser } from "../worker/synchro";
import type { Env } from "../worker/bd";

const reponseGemini = (objet: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(objet) }] } }] });
const BON = { derniere_etape: "Version ordi en ligne", prochaine_etape: "Tester le Sport sur la télé", avancement: 70 };

describe("agent : résumé d'un dépôt", () => {
  it("demande un résumé à Gemini et le valide", async () => {
    let corps: any;
    const f = (async (_u: RequestInfo | URL, init?: RequestInit) => { corps = JSON.parse(String(init?.body)); return reponseGemini(BON); }) as typeof fetch;
    const r = await resumerDepot("cle", "modele-test", { nom: "iptv-home", passation: "# PASSATION\nOù on en est…", readme: null, commits: [{ date: "2026-11-22", message: "Filtre Sport" }] }, f);
    expect(r).toEqual({ derniereEtape: "Version ordi en ligne", prochaineEtape: "Tester le Sport sur la télé", avancement: 70 });
    expect(JSON.stringify(corps)).toContain("Où on en est");
  });
  it("avancement absent ou hors bornes → null, jamais inventé", async () => {
    const f = (async () => reponseGemini({ ...BON, avancement: 140 })) as unknown as typeof fetch;
    expect((await resumerDepot("cle", "m", { nom: "x", passation: "p", readme: null, commits: [] }, f))?.avancement).toBeNull();
  });
  it("réponse illisible ou erreur → null", async () => {
    expect(await resumerDepot("cle", "m", { nom: "x", passation: "p", readme: null, commits: [] }, (async () => new Response("non", { status: 500 })) as unknown as typeof fetch)).toBeNull();
    expect(await resumerDepot("cle", "m", { nom: "x", passation: "p", readme: null, commits: [] }, (async () => Response.json({ candidates: [] })) as unknown as typeof fetch)).toBeNull();
  });
  it("rien à lire → pas d'appel", async () => {
    let appels = 0;
    const f = (async () => { appels++; return reponseGemini(BON); }) as unknown as typeof fetch;
    expect(await resumerDepot("cle", "m", { nom: "x", passation: null, readme: null, commits: [] }, f)).toBeNull();
    expect(appels).toBe(0);
  });
});

describe("agent dans la synchronisation", () => {
  const e = { ...(env as unknown as Env), GEMINI_CLE: "cle-gemini" } as Env;
  const db = e.DB;
  const depot = (id: number, name: string, pushed = "2026-11-22T23:49:16Z") => ({ id, name, full_name: `mizou5532/${name}`, html_url: `https://github.com/mizou5532/${name}`, homepage: null, private: false, archived: false, default_branch: "main", pushed_at: pushed });

  beforeEach(async () => { await db.batch([db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots")]); });

  function faux(depots: any[], fichiers: Record<string, string>) {
    const appelsIA: string[] = [];
    const f = (async (entree: RequestInfo | URL) => {
      const url = String(entree);
      if (url.includes("generativelanguage")) { appelsIA.push(url); return reponseGemini(BON); }
      if (url.includes("/user/repos")) return Response.json(url.includes("page=1") ? depots : []);
      if (url.includes("/commits")) return Response.json([]);
      const m = url.match(/repos\/mizou5532\/([^/]+)\/contents\/([^?]+)/);
      const contenu = m && fichiers[`${m[1]}/${m[2]}`];
      return contenu ? new Response(contenu) : new Response("absent", { status: 404 });
    }) as typeof fetch;
    return { f, appelsIA };
  }

  it("résume un dépôt sans fiche, une seule fois tant qu'il ne change pas", async () => {
    const { f, appelsIA } = faux([depot(30, "iptv-home")], { "iptv-home/PASSATION.md": "# PASSATION\nétat" });
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    const d = await db.prepare("SELECT resume_ia_json FROM depots WHERE github_id = 30").first<{ resume_ia_json: string }>();
    expect(JSON.parse(d!.resume_ia_json).prochaineEtape).toBe("Tester le Sport sur la télé");
    await synchroniser(e, new Date("2026-11-23T12:15:00Z"), f);
    expect(appelsIA).toHaveLength(1);
  });

  it("ne résume pas un dépôt qui a une fiche", async () => {
    const { f, appelsIA } = faux([depot(31, "pistes")], { "pistes/ETAT.md": "---\nstatut: en cours\n---\n", "pistes/PASSATION.md": "x" });
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    expect(appelsIA).toHaveLength(0);
  });

  it("au plus 3 résumés par passage", async () => {
    const lot = [1, 2, 3, 4, 5].map((i) => depot(40 + i, `d${i}`));
    const fichiers = Object.fromEntries(lot.map((d) => [`${d.name}/README.md`, "# Projet"]));
    const { f, appelsIA } = faux(lot, fichiers);
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    expect(appelsIA).toHaveLength(3);
    await synchroniser(e, new Date("2026-11-23T12:15:00Z"), f);
    expect(appelsIA).toHaveLength(5);
  });

  it("sans clé Gemini, aucun appel", async () => {
    const { f, appelsIA } = faux([depot(32, "iptv-home")], { "iptv-home/PASSATION.md": "x" });
    await synchroniser({ ...e, GEMINI_CLE: "" } as Env, new Date("2026-11-23T12:00:00Z"), f);
    expect(appelsIA).toHaveLength(0);
  });
});
