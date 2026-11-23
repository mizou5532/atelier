-- Suivi : historique de l'avancement, activité des dépôts, icône par projet.
CREATE TABLE historique (
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  jour TEXT NOT NULL,
  avancement INTEGER NOT NULL,
  PRIMARY KEY (projet_id, jour)
);
ALTER TABLE depots ADD COLUMN activite_json TEXT;
ALTER TABLE depots ADD COLUMN commits_recents_json TEXT;
ALTER TABLE depots ADD COLUMN activite_pour TEXT;
ALTER TABLE projets ADD COLUMN icone TEXT;
UPDATE projets SET icone = '📺' WHERE nom = 'IPTV maison';
UPDATE projets SET icone = '🖥️' WHERE nom = 'Serveur maison';
UPDATE projets SET icone = '💼' WHERE nom = 'Pistes';
UPDATE projets SET icone = '⚽' WHERE nom = 'Appli sportive';
UPDATE projets SET icone = '⚖️' WHERE nom = 'MonDroit.ca';
UPDATE projets SET icone = '🏀' WHERE nom = 'NBA';
UPDATE projets SET icone = '🩺' WHERE nom = 'Bot rendez-vous médecin';
UPDATE projets SET icone = '📦' WHERE nom = 'Dépôt entre mes appareils';
UPDATE projets SET icone = '🛠️' WHERE lower(nom) = 'atelier';
