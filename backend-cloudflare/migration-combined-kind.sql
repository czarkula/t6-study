PRAGMA foreign_keys = off;

CREATE TABLE scores_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('boldface', 'ops', 'combined')),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO scores_new (id, name, kind, elapsed_ms, created_at)
SELECT id, name, kind, elapsed_ms, created_at
FROM scores;

DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;

CREATE INDEX IF NOT EXISTS idx_scores_elapsed_ms ON scores (elapsed_ms);

PRAGMA foreign_keys = on;
