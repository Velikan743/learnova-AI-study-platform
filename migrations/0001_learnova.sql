CREATE TABLE IF NOT EXISTS learnova_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learnova_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES learnova_accounts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type = 'application/pdf'),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learnova_documents_user_created_idx
  ON learnova_documents (user_id, created_at DESC)
  WHERE status = 'uploaded';
