import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { synchroniser } from "../worker/synchro";
import { api } from "./aide";
import type { Env } from "../worker/bd";

const e = env as unknown as Env;
const db = e.DB;
let stats: number = 200;

function faux(pousse = "2026-11-23T19:00:00Z") {
  return (async (entree: RequestInfo | URL) => {
    const u = String(entree);
    if (u.includes("/user/repos")) return Response.json(u.includes("page=1") ? [{ id: 90, name: "pistes", full_name: "mizou5532/pistes", html_url: "https://github.com/mizou5532/pistes", homepage: null, private: true, archived: false, default_branch: "main", pushed_at: pousse }] : []);
    if (u.includes("/stats/commit_activity")) return stats === 202 ? new Response("", { status: 202 }) : Response.json([{ week: Date.UTC(2026, 10, 15) / 1000, days: [0, 2, 0, 0, 1, 0, 3] }]);
    if (u.includes("/commits?") && (u.includes("since=") || u.includes("per_page=100"))) return Response.json(u.includes("until=") ? [] : [{ sha: "c1", commit: { author: { date: "2026-11-22T10:00:00Z" }, message: "a" } }, { sha: "c2", commit: { author: { date: "2026-11-22T11:00:00Z" }, message: "b" } }]);
    if (u.includes("/commits")) return Response.json([]);
    if (u.includes("ETAT.md")) return new Response("---\nstatut: en cours\navancement: 60\n---\n");
    return new Response("absent", { status: 404 });
  }) as typeof fetch;
}

beforeEach(async () => {
  stats = 200;
  await db.batch([db.prepare("DELETE FROM historique"), db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots"), db.prepare("UPDATE projets SET avancement = NULL")]);
  await db.prepare("INSERT OR REPLACE INTO rattachements_depart (nom_depot, projet_id) VALUES ('pistes', 3)").run();
});

describe("suivi", () => {
  it("garde l'activité annuelle et les commits récents du dépôt", async () => {
    await synchroniser(e, new Date("2026-11-23T20:00:00Z"), faux());
    const d = await db.prepare("SELECT activite_json, commits_recents_json FROM depots WHERE github_id = 90").first<any>();
    expect(JSON.parse(d.activite_json)).toEqual({ "2026-11-16": 2, "2026-11-19": 1, "2026-11-21": 3 });
    expect(JSON.parse(d.commits_recents_json)).toHaveLength(2);
  });

  it("GitHub encore en calcul (202) : on réessaie au prochain passage", async () => {
    stats = 202;
    await synchroniser(e, new Date("2026-11-23T20:00:00Z"), faux());
    expect((await db.prepare("SELECT activite_pour FROM depots WHERE github_id = 90").first<any>()).activite_pour).toBeNull();
    stats = 200;
    await synchroniser(e, new Date("2026-11-23T20:15:00Z"), faux());
    expect((await db.prepare("SELECT activite_json FROM depots WHERE github_id = 90").first<any>()).activite_json).not.toBeNull();
  });

  it("note l'avancement du jour dans l'historique, et calcule la progression de la semaine", async () => {
    await db.prepare("INSERT INTO historique (projet_id, jour, avancement) VALUES (3, '2026-11-15', 40)").run();
    await synchroniser(e, new Date("2026-11-23T20:00:00Z"), faux());
    const h = (await db.prepare("SELECT jour, avancement FROM historique WHERE projet_id = 3 ORDER BY jour").all()).results;
    expect(h).toEqual([{ jour: "2026-11-15", avancement: 40 }, { jour: "2026-11-23", avancement: 60 }]);
    const pistes = ((await (await api("/api/accueil")).json()) as any).enCours.find((p: any) => p.nom === "Pistes");
    expect(pistes.icone).toBe("💼");
    expect(pistes.historique.map((x: any) => x.avancement)).toEqual([40, 60]);
    expect(typeof pistes.heuresSemaine).toBe("number");
  });

  it("calendrier d'activité : jours avec leurs projets (depuis l'historique complet)", async () => {
    await db.prepare("DELETE FROM commits").run();
    await synchroniser(e, new Date("2026-11-23T20:00:00Z"), faux());
    const a = (await (await api("/api/activite")).json()) as any;
    const jour = a.jours.find((j: any) => j.jour === "2026-11-22");
    expect(jour).toMatchObject({ total: 2, projets: [{ nom: "Pistes", n: 2 }] });
  });

  it("résumé de la semaine", async () => {
    await synchroniser(e, new Date("2026-11-23T20:00:00Z"), faux());
    const s = (await (await api("/api/semaine")).json()) as any;
    expect(s).toHaveProperty("actifs");
    expect(s).toHaveProperty("echecs");
    expect(s).toHaveProperty("endormis");
    expect(s.actifs.map((p: any) => p.nom)).toContain("Pistes");
  });

  it("changer l'icône d'un projet", async () => {
    await api("/api/projets/3", { method: "PATCH", corps: { icone: "🚀" } });
    expect(((await (await api("/api/projets/3")).json()) as any).icone).toBe("🚀");
  });
});

describe("dépôt vide ou réponse étrange de GitHub", () => {
  it("une réponse vide (204) pour l'activité ne casse pas la mise à jour", async () => {
    const base = faux();
    const f = (async (entree: RequestInfo | URL) => String(entree).includes("/stats/commit_activity") ? new Response(null, { status: 204 }) : base(entree)) as typeof fetch;
    const r = await synchroniser(e, new Date("2026-11-23T20:00:00Z"), f);
    expect(r.erreur).toBeUndefined();
    expect((await db.prepare("SELECT COUNT(*) n FROM historique").first<any>()).n).toBeGreaterThan(0);
  });
});
