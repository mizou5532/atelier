export const STATUTS = ["idee", "en_cours", "en_pause", "termine", "abandonne", "remplace"] as const;
export type Statut = (typeof STATUTS)[number];

export type Lien = { nom: string; url: string };

export type Fiche = {
  projet?: string;
  statut?: Statut;
  avancement?: number;
  derniereEtape?: string;
  prochaineEtape?: string;
  misAJour?: string;
  par?: string;
  liens: Lien[];
  enCours: string;
};
