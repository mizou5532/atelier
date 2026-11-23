export type Env = {
  DB: D1Database;
  ASSETS?: Fetcher;
  GITHUB_CLE: string;
  ACCES_EQUIPE: string;
  ACCES_AUD: string;
  ACCES_COURRIEL: string;
  ACCES_SERVICE_ID: string;
  GEMINI_CLE?: string;
  GEMINI_MODELE?: string;
};

export type ProjetBrut = {
  id: number; nom: string; couleur: string; statut: string | null; remplace_par: number | null;
  avancement: number | null; statut_ignore: string | null; avancement_ignore: number | null;
  notes: string; depot_principal: number | null; masque: number; modifie_le: string; cree_le: string;
  jalons_etat?: "aucun" | "propose" | "valide"; jalons_vus_pour?: string | null;
};

export type DepotBrut = {
  github_id: number; nom_complet: string; url: string; site: string | null; prive: number; archive: number;
  branche: string; pousse_le: string; projet_id: number | null; masque: number; disparu: number;
  fiche_json: string | null; fiche_etat: "absente" | "ok" | "a_verifier"; fiche_lue_pour: string | null; commits_json: string;
  resume_ia_json?: string | null; resume_ia_pour?: string | null;
  ci_etat?: "succes" | "echec" | "en_cours" | null; ci_nom?: string | null; ci_quand?: string | null; ci_url?: string | null;
};

export async function lireProjets(db: D1Database): Promise<ProjetBrut[]> {
  return (await db.prepare("SELECT * FROM projets ORDER BY id").all<ProjetBrut>()).results;
}

export async function lireDepots(db: D1Database): Promise<DepotBrut[]> {
  return (await db.prepare("SELECT * FROM depots ORDER BY github_id").all<DepotBrut>()).results;
}

export async function lireReglage(db: D1Database, cle: string): Promise<string | null> {
  const r = await db.prepare("SELECT valeur FROM reglages WHERE cle = ?").bind(cle).first<{ valeur: string }>();
  return r?.valeur ?? null;
}
