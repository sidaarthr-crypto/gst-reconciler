ALTER TABLE reconciliation_sessions
  ADD COLUMN IF NOT EXISTS client_gstin TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_client_gstin
  ON reconciliation_sessions(client_gstin);

CREATE INDEX IF NOT EXISTS idx_sessions_client_name
  ON reconciliation_sessions(client_name);
