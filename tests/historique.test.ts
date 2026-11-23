import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { detecterIA, decouperJour, preferencesParDefaut, fusionnerPreferences } from "../shared/historique";
import { synchroniser } from "../worker/synchro";
import { api } from "./aide";
import type { Env } from "../worker/bd";

describe("quelle IA a fait le commit", () => {
  it("reconnaît les signatures habituelles", () => {
    expect(detecterIA("Ajout\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", "moi@x.ca")).toBe("claude");
    expect(detecterIA("🤖 Generated with Claude Code", "")).toBe("claude");
    expect(detecterIA("fix\n\nCo-authored-by: Codex <codex@openai.com>", "")).toBe("codex");
    expect(detecterIA("Passation (Antigravity)", "")).toBe("antigravity");
    expect(detecterIA("Initial commit from v0", "")).toBe("autre");
    expect(detecterIA("commit", "41898282+github-copilot[bot]@users.noreply.github.com")).toBe("copilot");
  });
});

describe("une journée découpée", () => {
  it("temps et part par projet, IA utilisées, à l'heure de Montréal", () => {
    const j = decouperJour("2026-11-22", [
      { projetId: 1, projet: "IPTV", quand: "2026-11-22T14:00:00Z", message: "a", ia: "claude" },
      { projetId: 1, projet: "IPTV", quand: "2026-11-22T14:40:00Z", message: "b", ia: "claude" },
      { projetId: 3, projet: "Pistes", quand: "2026-11-22T20:00:00Z", message: "c", ia: "antigravity" },
      { projetId: 3, projet: "Pistes", quand: "2026-11-23T04:30:00Z", message: "hors jour (23 h 30 le 22 à Montréal compte)", ia: "codex" },
      { projetId: 3, projet: "Pistes", quand: "2026-11-23T06:00:00Z", message: "1 h le 23 : exclu", ia: "codex" },
    ]);
    expect(j.total).toBe(4);
    const iptv = j.projets.find((p) => p.projet === "IPTV")!;
    expect(iptv.minutes).toBe(60); // 40 min de séance + 20 min
    expect(j.projets.map((p) => p.projet)).toEqual(["IPTV", "Pistes"]);
    expect(Math.round(j.projets.reduce((s, p) => s + p.part, 0))).toBe(100);
    expect(j.ia).toEqual({ claude: 2, antigravity: 1, codex: 1 });
    expect(j.premier).toBe("9 h"); expect(j.dernier).toBe("23 h 30");
  });
});

describe("préférences", () => {
  it("valeurs par défaut complétées par ce qui est enregistré", () => {
    const p = fusionnerPreferences({ sections: { quotas: false }, accent: "vert" });
    expect(p.sections.quotas).toBe(false);
    expect(p.sections.calendrier).toBe(true);
    expect(p.accent).toBe("vert");
    expect(p.moisCalendrier).toBe(preferencesParDefaut.moisCalendrier);
  });
});

const e = env as unknown as Env;
const db = e.DB;

function fauxGithub(total: number) {
  // dépôt avec `total` commits, un par heure en partant du 2026-01-01
  const tous = Array.from({ length: total }, (_, i) => ({ sha: `s${i}`, commit: { message: i % 2 ? "Co-Authored-By: Claude <noreply@anthropic.com>" : "x", author: { date: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(), email: "moi@x.ca" } } })).reverse();
  let appelsCommits = 0;
  const f = (async (entree: RequestInfo | URL) => {
    const u = new URL(String(entree));
    if (u.pathname === "/user/repos") return Response.json(u.searchParams.get("page") === "1" ? [{ id: 95, name: "iptv-home", full_name: "mizou5532/iptv-home", html_url: "https://github.com/mizou5532/iptv-home", homepage: null, private: false, archived: false, default_branch: "main", pushed_at: "2026-11-22T00:00:00Z" }] : []);
    if (u.pathname.endsWith("/commits") && (u.searchParams.has("until") || u.searchParams.get("per_page") === "100")) {
      appelsCommits++;
      const jusqua = u.searchParams.get("until");
      const depuis = u.searchParams.get("since");
      const page = Number(u.searchParams.get("page") ?? "1");
      let liste = tous.filter((c) => (!jusqua || c.commit.author.date < jusqua) && (!depuis || c.commit.author.date > depuis));
      liste = liste.slice((page - 1) * 100, page * 100);
      return Response.json(liste);
    }
    if (u.pathname.endsWith("/commits")) return Response.json(tous.slice(0, 5));
    return new Response("absent", { status: 404 });
  }) as typeof fetch;
  return { f, appels: () => appelsCommits };
}

describe("import de tout l'historique", () => {
  beforeEach(async () => {
    await db.batch([db.prepare("DELETE FROM commits"), db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM depots")]);
    await db.prepare("INSERT OR REPLACE INTO rattachements_depart (nom_depot, projet_id) VALUES ('iptv-home', 1)").run();
  });

  it("importe par morceaux jusqu'au tout premier commit, puis seulement les nouveaux", async () => {
    const { f } = fauxGithub(450);
    for (let i = 0; i < 4; i++) await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    expect((await db.prepare("SELECT COUNT(*) n FROM commits").first<any>()).n).toBe(450);
    expect((await db.prepare("SELECT import_complet FROM depots WHERE github_id = 95").first<any>()).import_complet).toBe(1);
    expect((await db.prepare("SELECT COUNT(*) n FROM commits WHERE ia = 'claude'").first<any>()).n).toBe(225);
  });

  it("calendrier et page d'une journée", async () => {
    const { f } = fauxGithub(30);
    await synchroniser(e, new Date("2026-11-23T12:00:00Z"), f);
    const cal = (await (await api("/api/activite?mois=12")).json()) as any;
    expect(cal.jours.length).toBeGreaterThan(0);
    const jour = (await (await api(`/api/jour/${cal.jours[0].jour}`)).json()) as any;
    expect(jour.projets[0]).toMatchObject({ projet: "IPTV maison" });
    expect(jour.projets[0].commits.length).toBeGreaterThan(0);
    expect(jour).toHaveProperty("ia");
  });

  it("préférences enregistrées côté serveur", async () => {
    await api("/api/preferences", { method: "PATCH", corps: { sections: { quotas: false }, accent: "orange" } });
    const p = (await (await api("/api/preferences")).json()) as any;
    expect(p.sections.quotas).toBe(false);
    expect(p.accent).toBe("orange");
    expect((await api("/api/preferences", { method: "PATCH", corps: { accent: "<script>" } })).status).toBe(400);
  });
});
