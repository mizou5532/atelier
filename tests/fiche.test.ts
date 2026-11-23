import { describe, it, expect } from "vitest";
import { lireFiche, normaliserStatut } from "../shared/fiche";

const EXEMPLE = `---
projet: IPTV maison
statut: en cours          # idée | en cours | en pause | terminé | abandonné
avancement: 70            # 0 à 100, estimé d'après le plan, arrondi à 5
derniere_etape: Version ordinateur de la page web corrigée et mise en ligne
prochaine_etape: Tester le filtre Sport « En direct » sur la télé du salon
mis_a_jour: 2026-11-22 18:49
par: Claude Code (compte 2)
liens:
  - Site: https://iptv-home-config.vercel.app/
---

## En cours
- Ce que je fais : le compteur
- Prochaine action précise : brancher le serveur

## Autre section
Rien.
`;

const avec = (entete: string, suite = "") => `---\n${entete}\n---\n${suite}`;

describe("lecture de la fiche ETAT.md", () => {
  it("lit une fiche complète", () => {
    const r = lireFiche(EXEMPLE);
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    expect(r.fiche.statut).toBe("en_cours");
    expect(r.fiche.avancement).toBe(70);
    expect(r.fiche.prochaineEtape).toBe("Tester le filtre Sport « En direct » sur la télé du salon");
    expect(r.fiche.par).toBe("Claude Code (compte 2)");
    expect(r.fiche.liens).toEqual([{ nom: "Site", url: "https://iptv-home-config.vercel.app/" }]);
    expect(r.fiche.enCours).toBe("- Ce que je fais : le compteur\n- Prochaine action précise : brancher le serveur");
  });

  it("ignore accents et majuscules du statut", () => {
    expect(normaliserStatut("Terminé")).toBe("termine");
    expect(normaliserStatut("EN PAUSE")).toBe("en_pause");
    expect(normaliserStatut("Idée")).toBe("idee");
    expect(normaliserStatut("bientôt")).toBeNull();
  });

  it("YAML cassé : à vérifier", () => {
    expect(lireFiche(avec("statut: [en cours")).etat).toBe("a_verifier");
  });

  it("avancement hors bornes : à vérifier", () => {
    expect(lireFiche(avec("statut: en cours\navancement: 140")).etat).toBe("a_verifier");
  });

  it("garde l'avancement tel quel", () => {
    const r = lireFiche(avec("statut: en cours\navancement: 72"));
    expect(r.etat === "ok" && r.fiche.avancement).toBe(72);
  });

  it("statut inconnu : à vérifier", () => {
    expect(lireFiche(avec("statut: bientôt")).etat).toBe("a_verifier");
  });

  it("sans en-tête : à vérifier", () => {
    expect(lireFiche("# Juste un titre\n").etat).toBe("a_verifier");
  });

  it("En cours vide", () => {
    const r1 = lireFiche(avec("statut: en cours", "\n## En cours\n(Vide quand aucune étape n'est en cours.)\n"));
    expect(r1.etat === "ok" && r1.fiche.enCours).toBe("");
    const r2 = lireFiche(avec("statut: en cours"));
    expect(r2.etat === "ok" && r2.fiche.enCours).toBe("");
  });
});
