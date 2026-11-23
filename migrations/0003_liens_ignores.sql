-- Liens retirés par le propriétaire : la synchronisation ne les remet pas.
CREATE TABLE liens_ignores (
  projet_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (projet_id, url)
);
