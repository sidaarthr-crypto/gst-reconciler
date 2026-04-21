-- ─────────────────────────────────────────
-- TABLE 1: reconciliation_sessions
-- One row per upload/reconciliation attempt
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        TEXT NOT NULL UNIQUE,
  -- request_id format: RECON-YYYYMMDD-XXXX 
  -- (date + 4 char nanoid, e.g. RECON-20240415-K9XP)
  
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN 
                    ('pending','processing','completed','failed')),
  
  reconciliation_period_month  INTEGER NOT NULL 
                    CHECK (reconciliation_period_month BETWEEN 1 AND 12),
  reconciliation_period_year   INTEGER NOT NULL 
                    CHECK (reconciliation_period_year BETWEEN 2017 AND 2030),
  
  -- File metadata (no file content stored)
  gstr2b_filename   TEXT,
  gstr2b_row_count  INTEGER DEFAULT 0,
  pr_filename       TEXT,
  pr_row_count      INTEGER DEFAULT 0,
  
  -- Reconciliation summary (denormalised for fast reads)
  total_invoices    INTEGER DEFAULT 0,
  matched_count     INTEGER DEFAULT 0,
  mismatch_count    INTEGER DEFAULT 0,
  in_2b_only_count  INTEGER DEFAULT 0,
  in_pr_only_count  INTEGER DEFAULT 0,
  total_itc_at_risk NUMERIC(15,2) DEFAULT 0,
  total_itc_safe    NUMERIC(15,2) DEFAULT 0,
  
  error_message     TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE 2: gstr2b_invoices
-- Raw parsed rows from uploaded GSTR-2B file
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gstr2b_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL 
                    REFERENCES reconciliation_sessions(id) 
                    ON DELETE CASCADE,
  request_id        TEXT NOT NULL,
  row_index         INTEGER NOT NULL,
  
  -- Core fields (official GSTN field names in comments)
  supplier_gstin    TEXT NOT NULL,        -- ctin
  supplier_name     TEXT,                 -- trdnm
  supplier_filing_date TEXT,              -- supfildt
  supplier_period   TEXT,                 -- supprd
  invoice_number    TEXT NOT NULL,        -- inum
  invoice_type      TEXT,                 -- typ
  invoice_date      TEXT,                 -- dt
  invoice_value     NUMERIC(15,2),        -- val
  place_of_supply   TEXT,                 -- pos
  reverse_charge    TEXT DEFAULT 'N',     -- rev
  itc_available     TEXT DEFAULT 'Y',     -- itcavl (Y/N/T)
  itc_unavail_reason TEXT,               -- rsn
  taxable_value     NUMERIC(15,2) DEFAULT 0,  -- txval
  igst              NUMERIC(15,2) DEFAULT 0,
  cgst              NUMERIC(15,2) DEFAULT 0,
  sgst              NUMERIC(15,2) DEFAULT 0,
  cess              NUMERIC(15,2) DEFAULT 0,
  tax_rate          NUMERIC(5,2) DEFAULT 0,   -- rt
  
  -- Normalised keys for matching
  normalised_gstin  TEXT NOT NULL,
  normalised_inv_no TEXT NOT NULL,
  match_key         TEXT NOT NULL,  
  -- match_key = normalised_gstin||normalised_inv_no
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE 3: purchase_register_invoices
-- Raw parsed rows from uploaded Purchase Register
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_register_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL 
                    REFERENCES reconciliation_sessions(id) 
                    ON DELETE CASCADE,
  request_id        TEXT NOT NULL,
  row_index         INTEGER NOT NULL,
  
  supplier_gstin    TEXT NOT NULL,
  supplier_name     TEXT,
  invoice_number    TEXT NOT NULL,
  invoice_date      TEXT,
  taxable_value     NUMERIC(15,2) DEFAULT 0,
  igst              NUMERIC(15,2) DEFAULT 0,
  cgst              NUMERIC(15,2) DEFAULT 0,
  sgst              NUMERIC(15,2) DEFAULT 0,
  cess              NUMERIC(15,2) DEFAULT 0,
  total_invoice_value NUMERIC(15,2) DEFAULT 0,
  place_of_supply   TEXT,
  hsn_code          TEXT,
  
  -- Normalised keys for matching
  normalised_gstin  TEXT NOT NULL,
  normalised_inv_no TEXT NOT NULL,
  match_key         TEXT NOT NULL,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE 4: reconciliation_results
-- One row per invoice in final reconciliation output
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL 
                    REFERENCES reconciliation_sessions(id) 
                    ON DELETE CASCADE,
  request_id        TEXT NOT NULL,
  
  -- Invoice identity
  supplier_gstin    TEXT NOT NULL,
  supplier_name     TEXT,
  invoice_number    TEXT NOT NULL,
  invoice_date      TEXT,
  place_of_supply   TEXT,
  match_key         TEXT NOT NULL,
  
  -- Reconciliation output
  status            TEXT NOT NULL
                    CHECK (status IN (
                      'Matched',
                      'Value Mismatch', 
                      'In 2B Only',
                      'In PR Only'
                    )),
  itc_risk          TEXT NOT NULL
                    CHECK (itc_risk IN (
                      'Safe','Medium','High','Critical'
                    )),
  itc_available     TEXT,   -- Y/N/T from GSTR-2B
  reverse_charge    TEXT,
  
  -- GSTR-2B values
  taxable_2b        NUMERIC(15,2),
  igst_2b           NUMERIC(15,2),
  cgst_2b           NUMERIC(15,2),
  sgst_2b           NUMERIC(15,2),
  
  -- Purchase Register values
  taxable_pr        NUMERIC(15,2),
  igst_pr           NUMERIC(15,2),
  cgst_pr           NUMERIC(15,2),
  sgst_pr           NUMERIC(15,2),
  
  -- Differences (2B minus PR)
  taxable_diff      NUMERIC(15,2),
  igst_diff         NUMERIC(15,2),
  cgst_diff         NUMERIC(15,2),
  sgst_diff         NUMERIC(15,2),
  
  -- Risk computation
  total_itc_at_risk NUMERIC(15,2) DEFAULT 0,
  
  -- Guidance
  recommended_action TEXT NOT NULL,
  action_urgency    TEXT NOT NULL
                    CHECK (action_urgency IN (
                      'Immediate','Before Filing',
                      'Monitor','None'
                    )),
  
  -- Sort order (Critical=0, High=1, Medium=2, Safe=3)
  risk_sort_order   INTEGER NOT NULL DEFAULT 3,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE 5: app_config
-- Dynamic config — no hardcoding in frontend
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key               TEXT PRIMARY KEY,
  value             TEXT NOT NULL,
  description       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed app_config with all configurable values:
INSERT INTO app_config (key, value, description) VALUES
  ('itc_match_tolerance_inr',   '1',     
   'Max ₹ diff considered matched'),
  ('max_file_rows',             '10000', 
   'Max rows allowed per file'),
  ('request_id_prefix',        'RECON',  
   'Prefix for all request IDs'),
  ('supported_invoice_types',  'B2B',    
   'Invoice types supported in V1'),
  ('app_version',              '1.0.0',  
   'Current app version'),
  ('maintenance_mode',         'false',  
   'Toggle to take app offline'),
  ('free_tier_max_rows',       '200',    
   'Max rows on free tier'),
  ('show_sample_data_button',  'true',   
   'Show/hide Load Sample Data button')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_request_id 
  ON reconciliation_sessions(request_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
  ON reconciliation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gstr2b_session 
  ON gstr2b_invoices(session_id);
CREATE INDEX IF NOT EXISTS idx_gstr2b_match_key 
  ON gstr2b_invoices(match_key);
CREATE INDEX IF NOT EXISTS idx_pr_session 
  ON purchase_register_invoices(session_id);
CREATE INDEX IF NOT EXISTS idx_pr_match_key 
  ON purchase_register_invoices(match_key);
CREATE INDEX IF NOT EXISTS idx_results_session 
  ON reconciliation_results(session_id);
CREATE INDEX IF NOT EXISTS idx_results_risk 
  ON reconciliation_results(itc_risk, risk_sort_order);
CREATE INDEX IF NOT EXISTS idx_results_status 
  ON reconciliation_results(status);

-- ─────────────────────────────────────────
-- Auto-update updated_at trigger
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON reconciliation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
