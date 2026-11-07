CREATE TABLE IF NOT EXISTS learnova_subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES learnova_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS learnova_subjects_user_name_unique
  ON learnova_subjects (user_id, lower(name));

CREATE INDEX IF NOT EXISTS learnova_subjects_user_created_idx
  ON learnova_subjects (user_id, created_at);
