import { describe, it, expect, beforeEach } from "vitest";
import { api, envTest } from "./aide";

const db = envTest.DB;

async function depot(id: number, nom: string, projet: number | null, extra: Record<string, unknown> = {}) {
  const v = { site: null, pousse_le: "2026-11-21T22:51:33Z", fiche_json: null, fiche_etat: "absente", masque: 0, ...extra };
  await db.prepare(`INSERT INTO depots (github_id, nom_complet, url, site, prive, archive, branche, pousse_le, projet_id, masque, fiche_json, fiche_etat, fiche_lue_pour)
    VALUES (?, ?, ?, ?, 1, 0, 'main', ?, ?, ?, ?, ?, ?)`)
    .bind(id, `mizou5532/${nom}`, `https://github.com/mizou5532/${nom}`, v.site, v.pousse_le, projet, v.masque, v.fiche_json, v.fiche_etat, v.pousse_le).run();
}

const FICHE_PISTES = JSON.stringify({ statut: "en_cours", avancement: 80, prochaineEtape: "Essais en ligne", derniereEtape: "Sources", liens: [], enCours: "Je fais : X" });

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM liens"), db.prepare("DELETE FROM liens_ignores"), db.prepare("DELETE FROM depots"),
    db.prepare("UPDATE projets SET avancement = NULL, statut_ignore = NULL, avancement_ignore = NULL, masque = 0, statut = CASE id WHEN 8 THEN 'idee' ELSE 'en_cours' END"),
    db.prepare("DELETE FROM projets WHERE id > 8"),
  ]);
  await depot(1, "iptv-home", 1, { pousse_le: "2026-11-22T23:49:16Z" });
  await depot(3, "pistes", 3, { fiche_json: FICHE_PISTES, fiche_etat: "ok" });
  await depot(5, "mondroit-ca", 5, { pousse_le: "2026-03-18T07:30:25Z" });
  await depot(99, "test", null, { pousse_le: "2023-07-28T08:14:46Z" });
});

const accueil = async () => (await (await api("/api/accueil")).json()) as any;

describe("API", () => {
  it("accueil : sections et tri", async () => {
    const a = await accueil();
    expect(a.aClasser.map((d: any) => d.nom)).toEqual(["test"]);
    const ordre = a.enCours.map((p: any) => p.nom);
    expect(ordre.indexOf("IPTV maison")).toBeLessThan(ordre.indexOf("Pistes"));
    expect(a.endormis.map((p: any) => p.nom)).toContain("MonDroit.ca");
    expect(a.idees.map((p: any) => p.nom)).toEqual(["Dépôt entre mes appareils"]);
    const pistes = a.enCours.find((p: any) => p.nom === "Pistes");
    expect(pistes.avancement).toBe(80);
    expect(pistes.prochaineEtape).toBe("Essais en ligne");
    expect(pistes.enTravail).toBe(true);
    expect(pistes.couleur).toBe("vert");
  });

  it("avancement inconnu → null, jamais 0", async () => {
    const iptv = (await accueil()).enCours.find((p: any) => p.nom === "IPTV maison");
    expect(iptv.avancement).toBeNull();
  });

  it("fiche projet", async () => {
    const r = await api("/api/projets/3");
    const p = (await r.json()) as any;
    expect(p.nom).toBe("Pistes");
    expect(p.enCours).toBe("Je fais : X");
    expect(p.depots.map((d: any) => d.nom)).toEqual(["pistes"]);
  });

  it("créer une idée", async () => {
    const r = await api("/api/projets", { method: "POST", corps: { nom: "Une idée", statut: "idee", notes: "n" } });
    expect(r.status).toBe(201);
    expect((await accueil()).idees.map((p: any) => p.nom)).toContain("Une idée");
  });

  it("modifier le statut et l'avancement", async () => {
    await api("/api/projets/1", { method: "PATCH", corps: { statut: "en_pause", avancement: 55 } });
    const p = (await (await api("/api/projets/1")).json()) as any;
    expect(p.statut).toBe("en_pause");
    expect(p.avancement).toBe(55);
    expect((await api("/api/projets/1", { method: "PATCH", corps: { avancement: 140 } })).status).toBe(400);
  });

  it("propositions : accepter et ignorer", async () => {
    await api("/api/projets/3", { method: "PATCH", corps: { avancement: 70 } });
    let p = (await (await api("/api/projets/3")).json()) as any;
    expect(p.proposition.avancement).toBe(80);
    await api("/api/projets/3/propositions", { method: "POST", corps: { champ: "avancement", action: "ignorer" } });
    p = (await (await api("/api/projets/3")).json()) as any;
    expect(p.proposition.avancement).toBeUndefined();
    expect(p.avancement).toBe(70);
    await db.prepare("UPDATE depots SET fiche_json = ? WHERE github_id = 3").bind(FICHE_PISTES.replace('"avancement":80', '"avancement":85')).run();
    p = (await (await api("/api/projets/3")).json()) as any;
    expect(p.proposition.avancement).toBe(85);
    await api("/api/projets/3/propositions", { method: "POST", corps: { champ: "avancement", action: "accepter" } });
    p = (await (await api("/api/projets/3")).json()) as any;
    expect(p.avancement).toBe(85);
    expect(p.proposition.avancement).toBeUndefined();
  });

  it("supprimer : seulement sans dépôt", async () => {
    expect((await api("/api/projets/3", { method: "DELETE" })).status).toBe(409);
    expect((await api("/api/projets/8", { method: "DELETE" })).status).toBe(204);
  });

  it("classer : nouveau projet", async () => {
    await api("/api/depots/99/classer", { method: "POST", corps: { action: "nouveau" } });
    const a = await accueil();
    expect(a.aClasser).toEqual([]);
    expect([...a.enCours, ...a.endormis].map((p: any) => p.nom)).toContain("test");
  });

  it("classer : rattacher à une idée la démarre et garde ses notes", async () => {
    const { id } = (await (await api("/api/projets", { method: "POST", corps: { nom: "Idée X", statut: "idee", notes: "Difficulté 3 sur 5" } })).json()) as any;
    await api("/api/depots/99/classer", { method: "POST", corps: { action: "rattacher", projetId: id } });
    const p = (await (await api(`/api/projets/${id}`)).json()) as any;
    expect(p.statut).toBe("en_cours");
    expect(p.notes).toContain("Difficulté 3 sur 5");
    expect(p.depots.map((d: any) => d.nom)).toEqual(["test"]);
  });

  it("classer : masquer, puis réafficher", async () => {
    await api("/api/depots/99/classer", { method: "POST", corps: { action: "masquer" } });
    expect((await accueil()).aClasser).toEqual([]);
    const r = (await (await api("/api/reglages")).json()) as any;
    expect(r.masques.depots.map((d: any) => d.nom)).toEqual(["test"]);
    await api("/api/reglages", { method: "PATCH", corps: { reafficherDepot: 99 } });
    expect((await accueil()).aClasser.map((d: any) => d.nom)).toEqual(["test"]);
  });

  it("projet masqué absent de l'accueil, présent dans les réglages", async () => {
    await api("/api/projets/5", { method: "PATCH", corps: { masque: true } });
    const a = await accueil();
    expect(JSON.stringify(a)).not.toContain("MonDroit.ca");
    const r = (await (await api("/api/reglages")).json()) as any;
    expect(r.masques.projets.map((p: any) => p.nom)).toEqual(["MonDroit.ca"]);
  });

  it("détacher un dépôt le renvoie à classer", async () => {
    await api("/api/depots/5/detacher", { method: "POST" });
    expect((await accueil()).aClasser.map((d: any) => d.nom)).toContain("mondroit-ca");
  });

  it("liens à la main : ajouter et retirer", async () => {
    const r = await api("/api/projets/1/liens", { method: "POST", corps: { nom: "Supabase", url: "https://supabase.com/dashboard" } });
    const { id } = (await r.json()) as any;
    expect(((await (await api("/api/projets/1")).json()) as any).liens.map((l: any) => l.nom)).toContain("Supabase");
    await api(`/api/projets/1/liens/${id}`, { method: "DELETE" });
    expect(((await (await api("/api/projets/1")).json()) as any).liens.map((l: any) => l.nom)).not.toContain("Supabase");
    expect((await api("/api/projets/1/liens", { method: "POST", corps: { nom: "x", url: "javascript:alert(1)" } })).status).toBe(400);
  });

  it("réglages : seuil endormi", async () => {
    await api("/api/reglages", { method: "PATCH", corps: { seuilEndormiJours: 400 } });
    expect((await accueil()).endormis.map((p: any) => p.nom)).not.toContain("MonDroit.ca");
    await api("/api/reglages", { method: "PATCH", corps: { seuilEndormiJours: 30 } });
  });
});

describe("liens ajoutés automatiquement", () => {
  it("se retirent et ne reviennent pas à la synchronisation suivante", async () => {
    const { completerLiens } = await import("../worker/synchro");
    await db.prepare("UPDATE depots SET site = 'https://vieux-site.exemple/' WHERE github_id = 3").run();
    await completerLiens(db);
    const avant = ((await (await api("/api/projets/3")).json()) as any).liens;
    const auto = avant.find((l: any) => l.url === "https://vieux-site.exemple/");
    expect(auto.source).toBe("github");
    expect((await api(`/api/projets/3/liens/${auto.id}`, { method: "DELETE" })).status).toBe(204);
    await completerLiens(db);
    const apres = ((await (await api("/api/projets/3")).json()) as any).liens;
    expect(apres.map((l: any) => l.url)).not.toContain("https://vieux-site.exemple/");
  });
});
