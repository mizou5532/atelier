import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { derniereExecution } from "../worker/github";
import { synchroniser } from "../worker/synchro";
import { api } from "./aide";
import type { Env } from "../worker/bd";

const e = env as unknown as Env;
const db = e.DB;
const run = (conclusion: string | null, status = "completed") => ({ workflow_runs: [{ name: "Publier", status, conclusion, updated_at: "2026-11-23T20:00:00Z", html_url: "https://github.com/x/actions/runs/1" }] });

describe("voyant de mise en ligne", () => {
  it("lit la dernière exécution", async () => {
    const f = (async () => Response.json(run("failure"))) as unknown as typeof fetch;
    expect(await derniereExecution("cle", "mizou5532/pistes", "main", f)).toEqual({ etat: "echec", nom: "Publier", quand: "2026-11-23T20:00:00Z", url: "https://github.com/x/actions/runs/1" });
    expect((await derniereExecution("cle", "a/b", "main", (async () => Response.json(run(null, "in_progress"))) as unknown as typeof fetch))?.etat).toBe("en_cours");
    expect((await derniereExecution("cle", "a/b", "main", (async () => Response.json(run("success"))) as unknown as typeof fetch))?.etat).toBe("succes");
    expect(await derniereExecution("cle", "a/b", "main", (async () => Response.json({ workflow_runs: [] })) as unknown as typeof fetch)).toBeNull();
  });

  it("sans permission Actions : pas de voyant, et surtout pas de « clé refusée »", async () => {
    const f = (async () => new Response("non", { status: 403 })) as unknown as typeof fetch;
    expect(await derniereExecution("cle", "a/b", "main", f)).toBeNull();
  });

  beforeEach(async () => { await db.batch([db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots"), db.prepare("UPDATE etat_synchro SET erreur = NULL")]); });

  it("la carte montre le voyant", async () => {
    await db.prepare("INSERT OR REPLACE INTO rattachements_depart (nom_depot, projet_id) VALUES ('pistes', 3)").run();
    const f = (async (entree: RequestInfo | URL) => {
      const u = String(entree);
      if (u.includes("/user/repos")) return Response.json(u.includes("page=1") ? [{ id: 80, name: "pistes", full_name: "mizou5532/pistes", html_url: "https://github.com/mizou5532/pistes", homepage: null, private: true, archived: false, default_branch: "main", pushed_at: "2026-11-23T19:00:00Z" }] : []);
      if (u.includes("/actions/runs")) return Response.json(run("failure"));
      if (u.includes("/commits")) return Response.json([]);
      return new Response("absent", { status: 404 });
    }) as typeof fetch;
    const r = await synchroniser(e, new Date("2026-11-23T20:05:00Z"), f);
    expect(r.erreur).toBeUndefined();
    const pistes = ((await (await api("/api/accueil")).json()) as any).enCours.find((p: any) => p.nom === "Pistes");
    expect(pistes.voyant).toMatchObject({ etat: "echec", url: "https://github.com/x/actions/runs/1" });
  });
});
