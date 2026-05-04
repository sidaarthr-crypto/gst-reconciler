-- Migration 010: Fix RLS policies for all tables (permissive policies for authenticated + anon).
-- Drop all existing policies on these tables, then recreate.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN (
      'gstr2b_invoices',
      'purchase_register_invoices',
      'reconciliation_results',
      'reconciliation_sessions'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE gstr2b_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_register_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gstr2b_insert" ON gstr2b_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gstr2b_select" ON gstr2b_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "gstr2b_update" ON gstr2b_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gstr2b_delete" ON gstr2b_invoices FOR DELETE TO authenticated USING (true);
CREATE POLICY "gstr2b_anon_insert" ON gstr2b_invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "gstr2b_anon_select" ON gstr2b_invoices FOR SELECT TO anon USING (true);

CREATE POLICY "pr_insert" ON purchase_register_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pr_select" ON purchase_register_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr_anon_insert" ON purchase_register_invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pr_anon_select" ON purchase_register_invoices FOR SELECT TO anon USING (true);

CREATE POLICY "results_insert" ON reconciliation_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "results_select" ON reconciliation_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "results_anon_insert" ON reconciliation_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "results_anon_select" ON reconciliation_results FOR SELECT TO anon USING (true);

CREATE POLICY "sessions_insert" ON reconciliation_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sessions_select" ON reconciliation_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_update" ON reconciliation_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sessions_delete" ON reconciliation_sessions FOR DELETE TO authenticated USING (true);
CREATE POLICY "sessions_anon_insert" ON reconciliation_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "sessions_anon_select" ON reconciliation_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "sessions_anon_update" ON reconciliation_sessions FOR UPDATE TO anon USING (true);
