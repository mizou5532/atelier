-- Historique complet des commits de chaque dépôt (heure, message, IA utilisée).
CREATE TABLE commits (
  sha TEXT PRIMARY KEY,
  depot_id INTEGER NOT NULL REFERENCES depots(github_id) ON DELETE CASCADE,
  quand TEXT NOT NULL,
  message TEXT NOT NULL,
  ia TEXT NOT NULL CHECK (ia IN ('claude','codex','antigravity','gemini','copilot','autre'))
);
CREATE INDEX commits_quand ON commits(quand);
CREATE INDEX commits_depot ON commits(depot_id, quand);
ALTER TABLE depots ADD COLUMN import_complet INTEGER NOT NULL DEFAULT 0;
INSERT OR IGNORE INTO reglages (cle, valeur) VALUES ('preferences', '{}');
