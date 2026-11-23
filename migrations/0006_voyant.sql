-- Voyant : résultat de la dernière exécution GitHub Actions sur la branche principale.
ALTER TABLE depots ADD COLUMN ci_etat TEXT CHECK (ci_etat IN ('succes','echec','en_cours'));
ALTER TABLE depots ADD COLUMN ci_nom TEXT;
ALTER TABLE depots ADD COLUMN ci_quand TEXT;
ALTER TABLE depots ADD COLUMN ci_url TEXT;
