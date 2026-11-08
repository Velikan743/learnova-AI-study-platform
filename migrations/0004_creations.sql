CREATE TABLE IF NOT EXISTS learnova_creations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES learnova_accounts(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learnova_creations_user_tool_created_idx
  ON learnova_creations (user_id, tool, created_at DESC);
