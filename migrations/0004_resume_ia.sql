-- Résumé écrit par l'agent IA pour les dépôts sans fiche ETAT.md.
ALTER TABLE depots ADD COLUMN resume_ia_json TEXT;
ALTER TABLE depots ADD COLUMN resume_ia_pour TEXT;
