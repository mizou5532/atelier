import { describe, it, expect } from "vitest";
import { heuresTravaillees, joursDepuisStats, salutation, filtrerProjets } from "../shared/activite";

describe("temps passé", () => {
  it("regroupe les commits en séances (écart > 45 min = nouvelle séance) et ajoute 20 min par séance", () => {
    const d = ["2026-11-22T10:00:00Z", "2026-11-22T10:30:00Z", "2026-11-22T11:00:00Z", "2026-11-22T15:00:00Z"];
    // séance 1 : 1 h + 20 min ; séance 2 : 0 + 20 min → 1 h 40 = 1,67 h
    expect(heuresTravaillees(d, new Date("2026-11-16T00:00:00Z"))).toBeCloseTo(1.67, 1);
  });
  it("ignore ce qui est avant la date de départ, et rien → 0", () => {
    expect(heuresTravaillees(["2026-11-01T10:00:00Z"], new Date("2026-11-16T00:00:00Z"))).toBe(0);
    expect(heuresTravaillees([], new Date())).toBe(0);
  });
});

describe("activité annuelle de GitHub", () => {
  it("transforme les semaines en jours datés", () => {
    const semaines = [{ week: Date.UTC(2026, 10, 15) / 1000, days: [0, 2, 0, 0, 1, 0, 0] }];
    expect(joursDepuisStats(semaines)).toEqual({ "2026-11-16": 2, "2026-11-19": 1 });
  });
});

describe("salutation", () => {
  it("suit l'heure de Montréal", () => {
    expect(salutation(new Date("2026-11-23T13:00:00Z"))).toBe("Bon matin"); // 8 h
    expect(salutation(new Date("2026-11-23T19:00:00Z"))).toBe("Bon après-midi"); // 14 h
    expect(salutation(new Date("2026-11-24T00:30:00Z"))).toBe("Bonne soirée"); // 19 h 30
    expect(salutation(new Date("2026-11-24T07:00:00Z"))).toBe("Bonne nuit"); // 2 h
  });
});

describe("recherche rapide", () => {
  it("trouve par morceau de nom, sans accents ni majuscules", () => {
    const p = [{ nom: "IPTV maison" }, { nom: "Bot rendez-vous médecin" }, { nom: "Pistes" }];
    expect(filtrerProjets(p, "ipt").map((x) => x.nom)).toEqual(["IPTV maison"]);
    expect(filtrerProjets(p, "MEDECIN").map((x) => x.nom)).toEqual(["Bot rendez-vous médecin"]);
    expect(filtrerProjets(p, "").map((x) => x.nom)).toHaveLength(3);
  });
});
