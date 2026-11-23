import { describe, it, expect } from "vitest";
import { relatif, heureMontreal, jourMontreal } from "../shared/temps";

describe("temps", () => {
  it("relatif", () => {
    const m = new Date("2026-11-23T03:31:00Z");
    expect(relatif("2026-11-22T23:49:16Z", m)).toBe("il y a 3 h");
    expect(relatif("2026-11-22T02:00:00Z", m)).toBe("hier");
    expect(relatif("2026-11-23T03:20:00Z", m)).toBe("il y a 11 min");
    expect(relatif("2026-11-23T01:00:00Z", m)).toBe("il y a 2 h");
    expect(relatif("2026-11-20T15:00:00Z", m)).toBe("il y a 2 jours");
    expect(relatif("2026-03-18T07:30:25Z", m)).toBe("il y a 8 mois");
    expect(relatif("2023-07-28T08:14:46Z", m)).toBe("il y a 3 ans");
  });

  it("heure de Montréal, été comme hiver", () => {
    expect(heureMontreal("2026-11-24T14:00:00Z")).toBe("9 h");
    expect(heureMontreal("2026-07-01T13:20:00Z")).toBe("9 h 20");
    expect(jourMontreal("2026-11-30T14:00:00Z")).toBe("lun.");
  });
});
