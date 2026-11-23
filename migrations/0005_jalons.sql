-- Jalons : grandes étapes d'un projet jusqu'à sa version complète (proposées par l'agent, validées par le propriétaire).
CREATE TABLE jalons (
  id INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL,
  titre TEXT NOT NULL,
  fait INTEGER NOT NULL DEFAULT 0,
  coche_par TEXT CHECK (coche_par IN ('ia','main'))
);
ALTER TABLE projets ADD COLUMN jalons_etat TEXT NOT NULL DEFAULT 'aucun' CHECK (jalons_etat IN ('aucun','propose','valide'));
ALTER TABLE projets ADD COLUMN jalons_vus_pour TEXT;
