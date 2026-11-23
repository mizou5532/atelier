import type { CarteVue } from "../../shared/types";
import { couleur } from "./couleurs";
import { LienInterne } from "./Lien";
import { usePreferences } from "../preferences";

export function Pastille({ carte, taille = 44 }: { carte: Pick<CarteVue, "couleur" | "initiales"> & { icone?: string | null }; taille?: number }) {
  const c = couleur(carte.couleur);
  return (
    <span className="pastille" aria-hidden="true" style={{ background: c.doux, color: c.texte, width: taille, height: taille, fontSize: carte.icone ? taille * 0.5 : undefined }}>
      {carte.icone || carte.initiales}
    </span>
  );
}

export function Courbe({ points, nom, couleurNom, largeur = 120, hauteur = 32 }: { points: { avancement: number }[]; nom: string; couleurNom: string; largeur?: number; hauteur?: number }) {
  if (points.length < 2) return null;
  const c = couleur(couleurNom);
  const pas = largeur / (points.length - 1);
  const xy = points.map((p, i) => `${(i * pas).toFixed(1)},${(hauteur - 2 - (p.avancement / 100) * (hauteur - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="courbe" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={`Courbe d'avancement de ${nom}`}>
      <polyline points={xy} fill="none" stroke={c.fort} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function texteHeures(h: number): string | null {
  if (!h) return null;
  return h < 1 ? "moins d'1 h cette semaine" : `~${Math.round(h)} h cette semaine`;
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
  const vis = usePreferences().carte;
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
      {vis.voyant && carte.voyant && <Voyant v={carte.voyant} />}
      <Barre valeur={carte.avancement} nom={carte.couleur} />
      {vis.jalons && carte.jalonsResume && <p className="discret mini-note">{carte.jalonsResume}</p>}
      {(vis.courbe || vis.heures) && (carte.historique?.length > 1 || carte.deltaSemaine || carte.heuresSemaine > 0) && (
        <div className="carte-suivi">
          {vis.courbe && <Courbe points={carte.historique ?? []} nom={carte.nom} couleurNom={carte.couleur} />}
          <div className="carte-suivi-textes">
            {carte.deltaSemaine ? <span className={carte.deltaSemaine > 0 ? "hausse" : "baisse"}>{carte.deltaSemaine > 0 ? "+" : ""}{carte.deltaSemaine} % cette semaine</span> : null}
            {vis.heures && texteHeures(carte.heuresSemaine) && <span className="discret">{texteHeures(carte.heuresSemaine)}</span>}
          </div>
        </div>
      )}
      {carte.jalonsAValider && <LienInterne vers={`/projet/${carte.id}`} className="carte-note">Jalons proposés : à valider ›</LienInterne>}
      {vis.etapes && etape && <p className="carte-etape">{etape}</p>}
      {carte.estimeParIA && <p className="discret mini-note">estimé par l'IA</p>}
      {(carte.ficheAVerifier || carte.proposition.avancement !== undefined || carte.proposition.statut) && (
        <p className="carte-note">
          {carte.ficheAVerifier ? "Fiche à vérifier" : "Ton IA propose une mise à jour"}
        </p>
      )}
      {vis.liens && carte.liensRapides.length > 0 && (
        <div className="carte-liens">
          {carte.liensRapides.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.nom}</a>)}
        </div>
      )}
    </article>
  );
}

const VOYANTS = {
  succes: { texte: "Mise en ligne réussie", couleur: "#16A34A" },
  echec: { texte: "Mise en ligne échouée", couleur: "#DC2626" },
  en_cours: { texte: "Mise en ligne en cours", couleur: "#F59E0B" },
};

function Voyant({ v }: { v: NonNullable<CarteVue["voyant"]> }) {
  const s = VOYANTS[v.etat];
  return (
    <a className="voyant" href={v.url} target="_blank" rel="noreferrer">
      <span className="voyant-point" aria-hidden="true" style={{ background: s.couleur }} />
      {s.texte} · {v.relatif}
    </a>
  );
}
