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

export type DerniereVue = { quand: string; relatif: string; aLaMain: boolean };

export type CarteVue = {
  id: number;
  nom: string;
  couleur: string;
  initiales: string;
  statut: Statut;
  derniere: DerniereVue;
  avancement: number | null;
  proposition: { statut?: Statut; avancement?: number };
  derniereEtape?: string;
  prochaineEtape?: string;
  enTravail: boolean;
  ficheAVerifier: boolean;
  liensRapides: Lien[];
  nbDepots: number;
};

export type DepotVue = { githubId: number; nom: string; url: string; relatif: string };

export type DetailVue = CarteVue & {
  notes: string;
  enCours: string;
  statutChoisi: Statut | null;
  remplacePar: number | null;
  liens: (Lien & { id: number; source: "main" | "github" | "fiche" })[];
  depots: { githubId: number; nom: string; url: string; prive: boolean; principal: boolean; disparu: boolean; ficheEtat: string }[];
  commits: { date: string; message: string }[];
};

export type QuotaVue = {
  compteId: number;
  nom: string;
  type: "claude" | "google" | "autre";
  plusLibre: boolean;
  fenetres: { fenetre: string; reste: number | null; etat: "normal" | "plein" | "bloque" | "a_confirmer" | "inconnu"; reinit?: { relatif: string; heure: string; jour: string }; source: "auto" | "main"; majRelatif: string }[];
};

export type AccueilVue = {
  maj: { derniereReussite: string | null; erreur: "injoignable" | "cle_refusee" | "interne" | null; erreurDepuis: string | null };
  aClasser: DepotVue[];
  enCours: CarteVue[];
  endormis: CarteVue[];
  idees: CarteVue[];
  archives: CarteVue[];
  quotas: QuotaVue[];
};
