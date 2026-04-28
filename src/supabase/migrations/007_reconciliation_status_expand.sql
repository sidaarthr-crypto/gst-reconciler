-- Additional reconciliation statuses (ITC / POS / CESS / tax rate).
ALTER TABLE public.reconciliation_results
  DROP CONSTRAINT IF EXISTS reconciliation_results_status_check;

ALTER TABLE public.reconciliation_results
  ADD CONSTRAINT reconciliation_results_status_check
  CHECK (status IN (
    'Matched',
    'Value Mismatch',
    'Tax Type Mismatch',
    'Suggested Match',
    'In 2B Only',
    'In PR Only',
    'QRMP Delay',
    'Duplicate',
    'RCM Invoice',
    'ITC Blocked',
    'ITC Temporary',
    'POS Mismatch',
    'CESS Mismatch',
    'Tax Rate Mismatch'
  ));
