-- Les sites Cloudflare du même compte ne pouvaient pas être vérifiés (erreur 1042) : on relance la découverte une fois pour tous.
UPDATE projets SET decouverte_pour = NULL;
-- Un projet qui porte encore exactement le nom de son dépôt n'a jamais été renommé à la main : l'agent peut lui donner son vrai nom.
UPDATE projets SET nom_auto = 1
WHERE nom_auto = 0 AND nom IN (SELECT substr(d.nom_complet, instr(d.nom_complet, '/') + 1) FROM depots d WHERE d.projet_id = projets.id);
