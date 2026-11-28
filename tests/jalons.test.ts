import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { proposerJalons, cocherJalons } from "../worker/agent";
import { synchroniser } from "../worker/synchro";
import { api } from "./aide";
import type { Env } from "../worker/bd";

const gemini = (o: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] });
const e = { ...(env as unknown as Env), GEMINI_CLE: "cle" } as Env;
const db = e.DB;

describe("agent : jalons", () => {
  it("propose entre 3 et 10 jalons, avec ceux déjà faits", async () => {
    const f = (async () => gemini({ jalons: [{ titre: "Liste des chaînes", fait: true }, { titre: "Lecteur vidéo", fait: true }, { titre: "Serveur maison", fait: false }, { titre: "Version ordinateur", fait: false }] })) as unknown as typeof fetch;
    const j = await proposerJalons("cle", "m", { nom: "iptv-home", document: "passation", commits: [] }, f);
    expect(j).toEqual([{ titre: "Liste des chaînes", fait: true }, { titre: "Lecteur vidéo", fait: true }, { titre: "Serveur maison", fait: false }, { titre: "Version ordinateur", fait: false }]);
  });
  it("refuse une liste trop courte ou illisible", async () => {
    expect(await proposerJalons("cle", "m", { nom: "x", document: "d", commits: [] }, (async () => gemini({ jalons: [{ titre: "Seul", fait: false }] })) as unknown as typeof fetch)).toBeNull();
    expect(await proposerJalons("cle", "m", { nom: "x", document: "d", commits: [] }, (async () => new Response("x", { status: 500 })) as unknown as typeof fetch)).toBeNull();
  });
  it("coche seulement des jalons existants", async () => {
    const f = (async () => gemini({ faits: [2, 9] })) as unknown as typeof fetch;
    const r = await cocherJalons("cle", "m", { nom: "x", document: "d", commits: [], jalons: [{ numero: 1, titre: "A", fait: true }, { numero: 2, titre: "B", fait: false }, { numero: 3, titre: "C", fait: false }] }, f);
    expect(r).toEqual([2]);
  });
});

function faux(reponseIA: () => unknown) {
  const appels: string[] = [];
  const f = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree);
    if (url.includes("generativelanguage")) {
      if (typeof init?.body === "string" && init.body.includes("graphiste")) return new Response("non", { status: 500 }); // logos : hors sujet ici
      appels.push(url); return gemini(reponseIA());
    }
    if (url.includes("/user/repos")) return Response.json(url.includes("page=1") ? [{ id: 70, name: "iptv-home", full_name: "mizou5532/iptv-home", html_url: "https://github.com/mizou5532/iptv-home", homepage: null, private: false, archived: false, default_branch: "main", pushed_at: pousse }] : []);
    if (url.includes("/commits")) return Response.json([]);
    if (url.includes("PASSATION.md")) return new Response("# PASSATION");
    return new Response("absent", { status: 404 });
  }) as typeof fetch;
  return { f, appels };
}
let pousse = "2026-11-22T23:49:16Z";

describe("jalons dans la synchronisation et l'API", () => {
  beforeEach(async () => {
    pousse = "2026-11-22T23:49:16Z";
    await db.batch([db.prepare("DELETE FROM jalons"), db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots"),
      db.prepare("UPDATE projets SET jalons_etat = 'aucun', jalons_vus_pour = NULL, avancement = NULL")]);
    await db.prepare("INSERT OR REPLACE INTO rattachements_depart (nom_depot, projet_id) VALUES ('iptv-home', 1)").run();
  });

  it("l'agent propose des jalons une fois; rien ne compte avant ta validation", async () => {
    const { f } = faux(() => ({ jalons: [{ titre: "A", fait: true }, { titre: "B", fait: false }, { titre: "C", fait: false }, { titre: "D", fait: false }], derniere_etape: "x", prochaine_etape: "y" }));
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    const p = (await (await api("/api/projets/1")).json()) as any;
    expect(p.jalonsEtat).toBe("propose");
    expect(p.jalons.map((j: any) => j.titre)).toEqual(["A", "B", "C", "D"]);
    expect(p.avancement).toBeNull();
  });

  it("une fois validés : avancement = faits ÷ total, et l'agent coche au prochain changement sans jamais décocher", async () => {
    const { f } = faux(() => ({ jalons: [{ titre: "A", fait: true }, { titre: "B", fait: false }, { titre: "C", fait: false }, { titre: "D", fait: false }] }));
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    await api("/api/projets/1/jalons/valider", { method: "POST" });
    let p = (await (await api("/api/projets/1")).json()) as any;
    expect(p.avancement).toBe(25);
    expect(p.jalonsResume).toBe("1 sur 4 jalons");
    const b = p.jalons.find((j: any) => j.titre === "B");
    await api(`/api/jalons/${p.jalons.find((j: any) => j.titre === "A").id}`, { method: "PATCH", corps: { fait: true } });
    pousse = "2026-11-23T10:00:00Z";
    const ensuite = faux(() => ({ faits: [2, 3] }));
    await synchroniser(e, new Date("2026-11-23T12:15:00Z"), ensuite.f);
    p = (await (await api("/api/projets/1")).json()) as any;
    expect(p.jalons.filter((j: any) => j.fait).map((j: any) => j.titre)).toEqual(["A", "B", "C"]);
    expect(p.jalons.find((j: any) => j.id === b.id).cochePar).toBe("ia");
    expect(p.avancement).toBe(75);
  });

  it("ton pourcentage à la main reste prioritaire", async () => {
    const { f } = faux(() => ({ jalons: [{ titre: "A", fait: true }, { titre: "B", fait: false }, { titre: "C", fait: false }] }));
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    await api("/api/projets/1/jalons/valider", { method: "POST" });
    await api("/api/projets/1", { method: "PATCH", corps: { avancement: 50 } });
    expect(((await (await api("/api/projets/1")).json()) as any).avancement).toBe(50);
  });

  it("modifier, ajouter, retirer, décocher à la main", async () => {
    const { f } = faux(() => ({ jalons: [{ titre: "A", fait: true }, { titre: "B", fait: false }, { titre: "C", fait: false }] }));
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    let p = (await (await api("/api/projets/1")).json()) as any;
    await api(`/api/jalons/${p.jalons[1].id}`, { method: "PATCH", corps: { titre: "B renommé" } });
    await api(`/api/jalons/${p.jalons[2].id}`, { method: "DELETE" });
    await api("/api/projets/1/jalons", { method: "POST", corps: { titre: "Nouveau" } });
    await api(`/api/jalons/${p.jalons[0].id}`, { method: "PATCH", corps: { fait: false } });
    p = (await (await api("/api/projets/1")).json()) as any;
    expect(p.jalons.map((j: any) => [j.titre, j.fait])).toEqual([["A", false], ["B renommé", false], ["Nouveau", false]]);
  });

  it("un projet avec une fiche qui donne déjà un % n'a pas besoin de jalons", async () => {
    const { f, appels } = faux(() => ({ jalons: [] }));
    const avecFiche = (async (entree: RequestInfo | URL, init?: RequestInit) => String(entree).includes("ETAT.md") ? new Response("---\nstatut: en cours\navancement: 60\n---\n") : f(entree, init)) as typeof fetch;
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), avecFiche);
    expect(appels.filter((u) => u.includes("generativelanguage"))).toHaveLength(0);
    expect(((await (await api("/api/projets/1")).json()) as any).jalonsEtat).toBe("aucun");
  });
});

describe("robustesse des jalons", () => {
  it("une liste trop longue est gardée (10 premiers) au lieu d'être rejetée", async () => {
    const douze = Array.from({ length: 12 }, (_, i) => ({ titre: `Étape ${i + 1}`, fait: false }));
    const j = await proposerJalons("cle", "m", { nom: "x", document: "d", commits: [] }, (async () => gemini({ jalons: douze })) as unknown as typeof fetch);
    expect(j).toHaveLength(10);
  });

  it("si l'agent échoue, il réessaie au passage suivant", async () => {
    pousse = "2026-11-22T23:49:16Z";
    await db.batch([db.prepare("DELETE FROM jalons"), db.prepare("DELETE FROM depots"), db.prepare("UPDATE projets SET jalons_etat = 'aucun', jalons_vus_pour = NULL")]);
    await db.prepare("INSERT OR REPLACE INTO rattachements_depart (nom_depot, projet_id) VALUES ('iptv-home', 1)").run();
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), faux(() => ({ rien: true })).f);
    await synchroniser(e, new Date("2026-11-23T12:15:00Z"), faux(() => ({ jalons: [{ titre: "A", fait: true }, { titre: "B", fait: false }, { titre: "C", fait: false }] })).f);
    expect(((await (await api("/api/projets/1")).json()) as any).jalonsEtat).toBe("propose");
  });

  it("la carte signale des jalons à valider", async () => {
    const a = (await (await api("/api/accueil")).json()) as any;
    const iptv = [...a.enCours, ...a.endormis].find((p: any) => p.nom === "IPTV maison");
    expect(iptv.jalonsAValider).toBe(true);
  });
});
