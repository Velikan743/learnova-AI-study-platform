ALTER TABLE learnova_accounts
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_key TEXT;
