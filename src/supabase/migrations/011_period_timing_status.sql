-- Allow "Period Timing Mismatch" (PR-only rows where invoice is 1–2 months before recon period).

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
    'Period Timing Mismatch',
    'QRMP Delay',
    'Duplicate',
    'RCM Invoice',
    'ITC Blocked',
    'ITC Temporary',
    'POS Mismatch',
    'CESS Mismatch',
    'Tax Rate Mismatch',
    'Date Gap Match',
    'Group Entity Match',
    'GSTIN Mismatch Match',
    'Amount-Led Match',
    'Consolidated Invoice Match',
    'Probable Month Match',
    'Unclaimed ITC',
    'ITC Eligibility Uncertain',
    'Debit Note Misclassified',
    'Partially Booked ITC',
    'ITC Reduced by Supplier',
    'Non-GST Entry'
  ));
