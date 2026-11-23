import { describe, it, expect } from "vitest";
import { statutEffectif, proposition, estEndormi, derniereActivite } from "../shared/regles";

const MAINTENANT = new Date("2026-11-23T12:00:00Z");
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

describe("règles", () => {
  it("statut effectif : le choix du propriétaire gagne", () => {
    expect(statutEffectif("en_pause", "termine")).toBe("en_pause");
    expect(statutEffectif(null, "termine")).toBe("termine");
    expect(statutEffectif(null, undefined)).toBe("en_cours");
  });

  it("propositions de l'IA", () => {
    expect(proposition(70, 80, null)).toBe(80);
    expect(proposition(70, 80, 80)).toBeNull();
    expect(proposition(70, 70, null)).toBeNull();
    expect(proposition(null, 80, null)).toBeNull();
    expect(proposition<string>("en_cours", "termine", null)).toBe("termine");
  });

  it("endormi après le seuil", () => {
    expect(estEndormi("en_cours", ilYa(31), MAINTENANT, 30)).toBe(true);
    expect(estEndormi("en_cours", ilYa(29), MAINTENANT, 30)).toBe(false);
    expect(estEndormi("en_pause", ilYa(300), MAINTENANT, 30)).toBe(false);
  });

  it("dernière activité", () => {
    expect(derniereActivite([], "2026-11-01T00:00:00Z")).toEqual({ quand: "2026-11-01T00:00:00Z", aLaMain: true });
    expect(derniereActivite([{ pousse_le: "2026-03-18T07:30:25Z" }, { pousse_le: "2026-03-17T18:52:19Z" }], "2026-11-01T00:00:00Z"))
      .toEqual({ quand: "2026-03-18T07:30:25Z", aLaMain: false });
  });
});
