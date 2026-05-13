-- Document type for GSTR-2B reconciliation rows (B2B, amendments, credit/debit notes)

ALTER TABLE reconciliation_results
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'B2B'
    CHECK (document_type IN ('B2B', 'B2BA', 'CDNR', 'CDNR-DN'));

ALTER TABLE reconciliation_sessions
  ADD COLUMN IF NOT EXISTS b2ba_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cdnr_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cdn_debit_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_results_doc_type
  ON reconciliation_results(session_id, document_type);
