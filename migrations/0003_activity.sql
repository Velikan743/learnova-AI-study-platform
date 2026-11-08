CREATE TABLE IF NOT EXISTS learnova_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES learnova_accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('study_session', 'quiz_generated')),
  subject TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learnova_activity_user_created_idx
  ON learnova_activity (user_id, created_at DESC);
