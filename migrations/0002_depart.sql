-- Atelier : données de départ (le propriétaire corrige tout ensuite dans l'app)
INSERT INTO projets (id, nom, couleur, statut, notes, modifie_le, cree_le) VALUES
  (1, 'IPTV maison', 'violet', 'en_cours', '', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (2, 'Serveur maison', 'orange', 'en_cours', 'Pas de dépôt à lui : son code vit dans iptv-home (apps/server).', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (3, 'Pistes', 'vert', 'en_cours', '', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (4, 'Appli sportive', 'bleu', 'en_cours', '', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (5, 'MonDroit.ca', 'rose', 'en_cours', '', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (6, 'NBA', 'ambre', 'en_cours', 'À décider : peut-être remplacé par l''appli sportive.', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (7, 'Bot rendez-vous médecin', 'violet', 'en_cours', '', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z'),
  (8, 'Dépôt entre mes appareils', 'orange', 'idee',
   'Difficulté 3 sur 5. Boîte de dépôt ultra rapide entre le Mac, le PC et l''iPhone (texte, liens, photos, vidéos), retrouvable plus tard. Canaux = simples tiroirs. Bouton Partager de l''iPhone : passer par un Raccourci Apple. Vidéos lourdes (170 à 400 Mo par minute en 4K). Même recette que Pistes. Critère : moins de 3 secondes entre « j''ouvre » et « c''est envoyé ».',
   '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z');

INSERT INTO rattachements_depart (nom_depot, projet_id) VALUES
  ('iptv-home', 1), ('pistes', 3), ('appli-sportive', 4),
  ('mondroit-ca', 5), ('v0-MonDroit.ca', 5),
  ('nba-betting-app', 6), ('nba-app-BONNE-ESPOIR', 6), ('v0-live-nba-scores', 6),
  ('V0-version-7-24-fevrier-version-la-plus-avancer', 6),
  ('bot-rdv-medecin', 7);

INSERT INTO comptes_ia (id, nom, type, ordre) VALUES
  (1, 'Claude 1', 'claude', 1), (2, 'Claude 2', 'claude', 2), (3, 'Google (Antigravity)', 'google', 3);

INSERT INTO reglages (cle, valeur) VALUES ('seuil_endormi_jours', '30');
INSERT INTO etat_synchro (id) VALUES (1);
