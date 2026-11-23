-- Atelier : schéma initial
CREATE TABLE projets (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  couleur TEXT NOT NULL,
  statut TEXT CHECK (statut IN ('idee','en_cours','en_pause','termine','abandonne','remplace')),
  remplace_par INTEGER REFERENCES projets(id),
  avancement INTEGER CHECK (avancement BETWEEN 0 AND 100),
  statut_ignore TEXT,
  avancement_ignore INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  depot_principal INTEGER,
  masque INTEGER NOT NULL DEFAULT 0,
  modifie_le TEXT NOT NULL,
  cree_le TEXT NOT NULL
);

CREATE TABLE depots (
  github_id INTEGER PRIMARY KEY,
  nom_complet TEXT NOT NULL,
  url TEXT NOT NULL,
  site TEXT,
  prive INTEGER NOT NULL,
  archive INTEGER NOT NULL,
  branche TEXT NOT NULL,
  pousse_le TEXT NOT NULL,
  projet_id INTEGER REFERENCES projets(id),
  masque INTEGER NOT NULL DEFAULT 0,
  disparu INTEGER NOT NULL DEFAULT 0,
  fiche_json TEXT,
  fiche_etat TEXT NOT NULL DEFAULT 'absente' CHECK (fiche_etat IN ('absente','ok','a_verifier')),
  fiche_lue_pour TEXT,
  commits_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE liens (
  id INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('main','github','fiche'))
);

CREATE TABLE rattachements_depart (
  nom_depot TEXT PRIMARY KEY,
  projet_id INTEGER NOT NULL
);

CREATE TABLE comptes_ia (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('claude','google','autre')),
  forfait TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  ordre INTEGER NOT NULL
);

CREATE TABLE courriels_claude (
  courriel TEXT PRIMARY KEY,
  compte_id INTEGER REFERENCES comptes_ia(id)
);

CREATE TABLE quotas (
  compte_id INTEGER NOT NULL REFERENCES comptes_ia(id),
  fenetre TEXT NOT NULL,
  utilise_pct REAL,
  bloque INTEGER NOT NULL DEFAULT 0,
  reinit_le TEXT,
  maj_le TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto','main')),
  PRIMARY KEY (compte_id, fenetre)
);

CREATE TABLE reglages (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE etat_synchro (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  derniere_reussite TEXT,
  erreur TEXT CHECK (erreur IN ('injoignable','cle_refusee')),
  erreur_depuis TEXT
);
