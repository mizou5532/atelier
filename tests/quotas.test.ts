import { describe, it, expect, beforeEach } from "vitest";
import { vueQuota, plusLibre } from "../shared/quotas";
import { api, envTest } from "./aide";

const M = new Date("2026-11-23T17:00:00Z"); // 12 h à Montréal
const db = envTest.DB;

describe("vueQuota", () => {
  it("reste = 100 − utilisé", () => {
    const v = vueQuota({ utilise_pct: 62, bloque: 0, reinit_le: "2026-11-30T14:00:00Z", maj_le: "2026-11-23T16:50:00Z" }, M);
    expect(v.reste).toBe(38);
    expect(v.etat).toBe("normal");
    expect(v.reinit?.heure).toBe("9 h");
    expect(v.reinit?.jour).toBe("lun.");
  });
  it("heure de retour passée → plein", () => {
    const v = vueQuota({ utilise_pct: 90, bloque: 0, reinit_le: "2026-11-23T16:00:00Z", maj_le: "2026-11-23T12:00:00Z" }, M);
    expect(v).toMatchObject({ etat: "plein", reste: 100 });
  });
  it("vieux de plus de 24 h → à confirmer", () => {
    expect(vueQuota({ utilise_pct: 10, bloque: 0, reinit_le: "2026-11-30T14:00:00Z", maj_le: "2026-11-22T16:00:00Z" }, M).etat).toBe("a_confirmer");
  });
  it("bloqué", () => {
    expect(vueQuota({ utilise_pct: null, bloque: 1, reinit_le: "2026-11-26T19:00:00Z", maj_le: "2026-11-23T16:00:00Z" }, M).etat).toBe("bloque");
  });
  it("aucune donnée → inconnu", () => {
    expect(vueQuota({ utilise_pct: null, bloque: 0, reinit_le: null, maj_le: "2026-11-23T16:00:00Z" }, M)).toMatchObject({ etat: "inconnu", reste: null });
  });
});

describe("plusLibre", () => {
  it("le plus de marge dans la session, puis la semaine; Google ignoré", () => {
    const n = (reste: number | null, etat = "normal") => ({ reste, etat }) as any;
    expect(plusLibre([
      { id: 1, type: "claude", session: n(60), semaine: n(38) },
      { id: 2, type: "claude", session: n(100, "plein"), semaine: n(82) },
      { id: 3, type: "google", session: n(100), semaine: n(100) },
    ])).toBe(2);
    expect(plusLibre([
      { id: 1, type: "claude", session: n(100, "plein"), semaine: n(20) },
      { id: 2, type: "claude", session: n(100, "plein"), semaine: n(82) },
    ])).toBe(2);
    expect(plusLibre([{ id: 1, type: "claude" }])).toBeNull();
  });
});

describe("routes des quotas", () => {
  beforeEach(async () => {
    await db.batch([db.prepare("DELETE FROM quotas"), db.prepare("DELETE FROM courriels_claude")]);
  });

  it("entrée Claude par le jeton de service", async () => {
    await db.prepare("INSERT INTO courriels_claude (courriel, compte_id) VALUES ('deux@exemple.ca', 2)").run();
    const r = await api("/api/quotas/claude", { method: "POST", charge: { common_name: "service-test.access" }, corps: {
      courriel: "deux@exemple.ca", session: { utilise_pct: 40, reinit_le: 1795450000 }, semaine: { utilise_pct: 18, reinit_le: 1795700000 },
    } });
    expect(r.status).toBe(204);
    const lignes = (await db.prepare("SELECT fenetre, utilise_pct, source FROM quotas WHERE compte_id = 2 ORDER BY fenetre").all()).results;
    expect(lignes).toEqual([{ fenetre: "semaine", utilise_pct: 18, source: "auto" }, { fenetre: "session", utilise_pct: 40, source: "auto" }]);
  });

  it("courriel inconnu → à associer", async () => {
    const r = await api("/api/quotas/claude", { method: "POST", charge: { common_name: "service-test.access" }, corps: { courriel: "nouveau@exemple.ca", session: { utilise_pct: 5, reinit_le: 1795450000 } } });
    expect(r.status).toBe(202);
    const a = (await (await api("/api/quotas")).json()) as any;
    expect(a.aAssocier).toEqual(["nouveau@exemple.ca"]);
    await api("/api/quotas/courriels", { method: "POST", corps: { courriel: "nouveau@exemple.ca", compteId: 1 } });
    expect(((await (await api("/api/quotas")).json()) as any).aAssocier).toEqual([]);
  });

  it("refuse un champ en trop (jamais de jeton)", async () => {
    const r = await api("/api/quotas/claude", { method: "POST", charge: { common_name: "service-test.access" }, corps: { courriel: "a@b.ca", token: "x" } });
    expect(r.status).toBe(400);
  });

  it("saisie à la main : 60 % dans 3 h", async () => {
    const r = await api("/api/quotas/main", { method: "POST", corps: { compteId: 3, fenetre: "Gemini Pro", reste: 60, revientDansHeures: 3 } });
    expect(r.status).toBe(204);
    const l = await db.prepare("SELECT utilise_pct, bloque, reinit_le, maj_le, source FROM quotas WHERE compte_id = 3").first<any>();
    expect(l.utilise_pct).toBe(40);
    expect(l.source).toBe("main");
    expect(new Date(l.reinit_le).getTime() - new Date(l.maj_le).getTime()).toBe(3 * 3_600_000);
  });

  it("saisie à la main : bloqué", async () => {
    await api("/api/quotas/main", { method: "POST", corps: { compteId: 3, fenetre: "Claude dans Antigravity", reste: "bloque", revientDansHeures: 72 } });
    expect((await db.prepare("SELECT bloque FROM quotas WHERE compte_id = 3").first<any>()).bloque).toBe(1);
  });

  it("l'accueil montre les quotas et le plus libre", async () => {
    await db.prepare("INSERT INTO courriels_claude (courriel, compte_id) VALUES ('deux@exemple.ca', 2)").run();
    const futur = Math.floor(Date.now() / 1000) + 3600;
    await api("/api/quotas/claude", { method: "POST", charge: { common_name: "service-test.access" }, corps: { courriel: "deux@exemple.ca", session: { utilise_pct: 10, reinit_le: futur }, semaine: { utilise_pct: 20, reinit_le: futur + 86400 } } });
    const a = (await (await api("/api/accueil")).json()) as any;
    expect(a.quotas.map((q: any) => q.nom)).toEqual(["Claude 1", "Claude 2", "Google (Antigravity)"]);
    const deux = a.quotas[1];
    expect(deux.plusLibre).toBe(true);
    expect(deux.fenetres.find((f: any) => f.fenetre === "session").reste).toBe(90);
  });
});

import { lireSaisieQuota } from "../shared/quotas";

describe("saisie rapide d'un quota", () => {
  it("comprend les façons naturelles d'écrire", () => {
    expect(lireSaisieQuota("60", "3")).toEqual({ reste: 60, revientDansHeures: 3 });
    expect(lireSaisieQuota("60 %", "3 h")).toEqual({ reste: 60, revientDansHeures: 3 });
    expect(lireSaisieQuota(" 45% ", "1,5 h")).toEqual({ reste: 45, revientDansHeures: 1.5 });
    expect(lireSaisieQuota("bloqué", "2 jours")).toEqual({ reste: "bloque", revientDansHeures: 48 });
    expect(lireSaisieQuota("Bloque", "4 j")).toEqual({ reste: "bloque", revientDansHeures: 96 });
  });
  it("refuse ce qui n'a pas de sens", () => {
    expect(lireSaisieQuota("abc", "3")).toBeNull();
    expect(lireSaisieQuota("60", "")).toBeNull();
    expect(lireSaisieQuota("140", "3")).toBeNull();
    expect(lireSaisieQuota("60", "demain")).toBeNull();
  });
});
