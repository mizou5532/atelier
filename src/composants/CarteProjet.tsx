import type { CarteVue } from "../../shared/types";
import { couleur } from "./couleurs";
import { LienInterne } from "./Lien";

export function Pastille({ carte, taille = 44 }: { carte: Pick<CarteVue, "couleur" | "initiales">; taille?: number }) {
  const c = couleur(carte.couleur);
  return <span className="pastille" aria-hidden="true" style={{ background: c.doux, color: c.texte, width: taille, height: taille }}>{carte.initiales}</span>;
}

export function Barre({ valeur, nom }: { valeur: number | null; nom: string }) {
  const c = couleur(nom);
  return (
    <div className="barre-ligne">
      <div className="barre" role="progressbar" aria-label="Avancement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={valeur ?? undefined}>
        {valeur !== null && <div className="barre-remplie" style={{ width: `${valeur}%`, background: c.fort }} />}
      </div>
      <span className={valeur === null ? "barre-chiffre inconnu" : "barre-chiffre"}>{valeur === null ? "—" : `${valeur} %`}</span>
    </div>
  );
}

export function CarteProjet({ carte }: { carte: CarteVue }) {
  const c = couleur(carte.couleur);
  const etape = carte.prochaineEtape ? `Prochaine : ${carte.prochaineEtape}` : carte.derniereEtape ? `Dernière : ${carte.derniereEtape}` : null;
  return (
    <article className="carte" data-carte>
      <div className="carte-tete">
        <Pastille carte={carte} />
        <div className="carte-titre">
          <LienInterne vers={`/projet/${carte.id}`} className="carte-nom">{carte.nom}</LienInterne>
          <span className="discret">{carte.derniere.relatif}{carte.derniere.aLaMain ? " (à la main)" : ""}</span>
        </div>
        {carte.enTravail && <span className="badge" style={{ background: c.doux, color: c.texte }}>en travail</span>}
      </div>
      <Barre valeur={carte.avancement} nom={carte.couleur} />
      {etape && <p className="carte-etape">{etape}</p>}
      {carte.estimeParIA && <p className="discret mini-note">estimé par l'IA</p>}
      {(carte.ficheAVerifier || carte.proposition.avancement !== undefined || carte.proposition.statut) && (
        <p className="carte-note">
          {carte.ficheAVerifier ? "Fiche à vérifier" : "Ton IA propose une mise à jour"}
        </p>
      )}
      {carte.liensRapides.length > 0 && (
        <div className="carte-liens">
          {carte.liensRapides.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.nom}</a>)}
        </div>
      )}
    </article>
  );
}
