-- Run in Supabase SQL editor (or via migration pipeline)

ALTER TABLE reconciliation_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reconciliation_sessions
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON reconciliation_sessions(user_id);
