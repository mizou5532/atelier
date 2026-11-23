import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { synchroniser } from "../worker/synchro";
import type { Env } from "../worker/bd";

const e = env as unknown as Env;
const db = e.DB;
const MAINTENANT = new Date("2026-11-23T12:00:00Z");

type DepotGh = { id: number; name: string; full_name: string; html_url: string; homepage: string | null; private: boolean; archived: boolean; default_branch: string; pushed_at: string };
const gh = (id: number, name: string, pushed_at = "2026-11-21T22:51:33Z", homepage: string | null = null): DepotGh => ({
  id, name, full_name: `mizou5532/${name}`, html_url: `https://github.com/mizou5532/${name}`, homepage,
  private: true, archived: false, default_branch: "main", pushed_at,
});

const FICHE = "---\nstatut: en cours\navancement: 60\nprochaine_etape: Essais en ligne\nliens:\n  - Site: https://pistes.exemple.dev/\n---\n";

function faux(depots: DepotGh[], fiches: Record<string, string | number> = {}, statut = 200) {
  const appels: string[] = [];
  const f = (async (entree: RequestInfo | URL) => {
    const url = String(entree);
    appels.push(url);
    if (statut !== 200) return new Response("non", { status: statut });
    if (url.includes("/user/repos")) return Response.json(url.includes("page=1") ? depots : []);
    const m = url.match(/repos\/mizou5532\/([^/]+)\/(contents\/ETAT\.md|commits)/);
    if (m && m[2] === "commits") return Response.json([{ commit: { message: "Premier\n\ndétail", author: { date: "2026-11-21T22:51:33Z" } } }]);
    if (m) {
      const f = fiches[m[1]];
      if (f === undefined) return new Response("absent", { status: 404 });
      return new Response(String(f));
    }
    return new Response("?", { status: 404 });
  }) as typeof fetch;
  return { f, appels };
}

const depot = (id: number) => db.prepare("SELECT * FROM depots WHERE github_id = ?").bind(id).first<Record<string, unknown>>();

beforeEach(async () => {
  await db.batch([db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots"), db.prepare("UPDATE etat_synchro SET derniere_reussite = NULL, erreur = NULL, erreur_depuis = NULL")]);
});

describe("synchronisation GitHub", () => {
  it("nouveau dépôt → À classer", async () => {
    const { f } = faux([gh(99, "test")]);
    const r = await synchroniser(e, MAINTENANT, f);
    expect(r.nouveaux).toBe(1);
    const d = await depot(99);
    expect(d?.projet_id).toBeNull();
    expect(d?.masque).toBe(0);
  });

  it("rattachement de départ", async () => {
    await db.prepare("INSERT OR IGNORE INTO rattachements_depart (nom_depot, projet_id) VALUES ('pistes', 3)").run();
    const { f } = faux([gh(10, "pistes")]);
    await synchroniser(e, MAINTENANT, f);
    expect((await depot(10))?.projet_id).toBe(3);
    expect(await db.prepare("SELECT 1 FROM rattachements_depart WHERE nom_depot = 'pistes'").first()).toBeNull();
  });

  it("un dépôt renommé reste dans son projet", async () => {
    await db.prepare("INSERT OR IGNORE INTO rattachements_depart (nom_depot, projet_id) VALUES ('pistes', 3)").run();
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")]).f);
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes-v2", "2026-11-22T00:00:00Z")]).f);
    const d = await depot(10);
    expect(d?.projet_id).toBe(3);
    expect(d?.nom_complet).toBe("mizou5532/pistes-v2");
  });

  it("relit la fiche seulement si le dépôt a changé", async () => {
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")], { pistes: FICHE }).f);
    expect(JSON.parse(String((await depot(10))?.fiche_json)).avancement).toBe(60);
    const second = faux([gh(10, "pistes")], { pistes: FICHE });
    await synchroniser(e, MAINTENANT, second.f);
    expect(second.appels.some((u) => u.includes("ETAT.md"))).toBe(false);
  });

  it("une fiche à vérifier garde les anciennes valeurs", async () => {
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")], { pistes: FICHE }).f);
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes", "2026-11-22T10:00:00Z")], { pistes: "---\navancement: 140\n---\n" }).f);
    const d = await depot(10);
    expect(d?.fiche_etat).toBe("a_verifier");
    expect(JSON.parse(String(d?.fiche_json)).avancement).toBe(60);
  });

  it("un dépôt disparu est marqué, pas effacé", async () => {
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes"), gh(11, "vieux")]).f);
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")]).f);
    expect((await depot(11))?.disparu).toBe(1);
  });

  it("clé refusée : bandeau, rien de modifié", async () => {
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")]).f);
    const r = await synchroniser(e, MAINTENANT, faux([], {}, 401).f);
    expect(r.erreur).toBe("cle_refusee");
    expect((await depot(10))?.disparu).toBe(0);
    const etat = await db.prepare("SELECT * FROM etat_synchro").first<Record<string, unknown>>();
    expect(etat?.erreur).toBe("cle_refusee");
    expect(etat?.erreur_depuis).toBe(MAINTENANT.toISOString());
  });

  it("GitHub injoignable, puis rétabli", async () => {
    const r = await synchroniser(e, MAINTENANT, faux([], {}, 503).f);
    expect(r.erreur).toBe("injoignable");
    const panne = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect((await synchroniser(e, MAINTENANT, panne)).erreur).toBe("injoignable");
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes")]).f);
    const etat = await db.prepare("SELECT * FROM etat_synchro").first<Record<string, unknown>>();
    expect(etat?.erreur).toBeNull();
    expect(etat?.derniere_reussite).toBe(MAINTENANT.toISOString());
  });

  it("liens du dépôt et de la fiche, sans doublon, liens à la main intacts", async () => {
    await db.prepare("INSERT OR IGNORE INTO rattachements_depart (nom_depot, projet_id) VALUES ('pistes', 3)").run();
    await db.prepare("INSERT INTO liens (projet_id, nom, url, source) VALUES (3, 'Mon lien', 'https://a.exemple/', 'main')").run();
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes", undefined, "https://pistes.exemple.dev/")], { pistes: FICHE }).f);
    await synchroniser(e, MAINTENANT, faux([gh(10, "pistes", "2026-11-22T10:00:00Z", "https://pistes.exemple.dev/")], { pistes: FICHE }).f);
    const liens = (await db.prepare("SELECT nom, url, source FROM liens WHERE projet_id = 3 ORDER BY id").all()).results;
    expect(liens).toEqual([
      { nom: "Mon lien", url: "https://a.exemple/", source: "main" },
      { nom: "Site", url: "https://pistes.exemple.dev/", source: "github" },
    ]);
  });
});

describe("clé refusée en cours de lecture d'une fiche", () => {
  it("s'arrête proprement sans rien écrire", async () => {
    const f = (async (entree: RequestInfo | URL) => {
      const url = String(entree);
      if (url.includes("/user/repos")) return Response.json([gh(12, "autre")]);
      return new Response("non", { status: 401 });
    }) as typeof fetch;
    const r = await synchroniser(e, MAINTENANT, f);
    expect(r.erreur).toBe("cle_refusee");
    expect(await depot(12)).toBeNull();
  });
});
