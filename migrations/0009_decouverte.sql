-- Découverte automatique : logo, vrai nom et site de chaque projet, revus à chaque changement poussé.
ALTER TABLE projets ADD COLUMN logo TEXT;            -- image en « data: » (png, svg, ico…)
ALTER TABLE projets ADD COLUMN logo_source TEXT CHECK (logo_source IN ('projet','site','ia','retire'));
ALTER TABLE projets ADD COLUMN logo_maj TEXT;        -- quand le logo a changé (sert à rafraîchir l'image)
ALTER TABLE projets ADD COLUMN nom_auto INTEGER NOT NULL DEFAULT 0; -- 1 = nom donné par Atelier (pas encore choisi à la main)
ALTER TABLE projets ADD COLUMN decouverte_pour TEXT; -- dernier « push » examiné par la découverte
ALTER TABLE depots ADD COLUMN site_trouve TEXT;      -- adresse du site trouvée par la découverte (vérifiée)
-- Sous-domaine workers.dev du compte Cloudflare (public) : sert à deviner l'adresse des projets Cloudflare.
INSERT OR IGNORE INTO reglages (cle, valeur) VALUES ('sous_domaine_workers', 'hamzahlal86');
