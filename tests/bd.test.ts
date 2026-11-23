import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { lireProjets, lireReglage } from "../worker/bd";

const db = (env as unknown as { DB: D1Database }).DB;

describe("base de données", () => {
  it("contient les données de départ", async () => {
    const projets = await lireProjets(db);
    expect(projets).toHaveLength(8);
    expect(projets.filter((p) => p.statut === "idee").map((p) => p.nom)).toEqual(["Dépôt entre mes appareils"]);
    const noms = (await db.prepare("SELECT nom_depot FROM rattachements_depart ORDER BY nom_depot").all<{ nom_depot: string }>()).results.map((r) => r.nom_depot);
    expect(noms).toEqual([
      "V0-version-7-24-fevrier-version-la-plus-avancer", "appli-sportive", "bot-rdv-medecin", "iptv-home",
      "mondroit-ca", "nba-app-BONNE-ESPOIR", "nba-betting-app", "pistes", "v0-MonDroit.ca", "v0-live-nba-scores",
    ]);
    const comptes = (await db.prepare("SELECT nom FROM comptes_ia ORDER BY ordre").all<{ nom: string }>()).results.map((r) => r.nom);
    expect(comptes).toEqual(["Claude 1", "Claude 2", "Google (Antigravity)"]);
    expect(await lireReglage(db, "seuil_endormi_jours")).toBe("30");
  });

  it("refuse un avancement hors bornes", async () => {
    await expect(db.prepare("UPDATE projets SET avancement = 140 WHERE id = 1").run()).rejects.toThrow();
  });

  it("refuse un statut inconnu", async () => {
    await expect(db.prepare("UPDATE projets SET statut = 'fini' WHERE id = 1").run()).rejects.toThrow();
  });
});
