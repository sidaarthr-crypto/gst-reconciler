-- Migration 011: Expand reconciliation_results status check constraint
-- Adds all 12 new check statuses from the engine upgrade

ALTER TABLE reconciliation_results
  DROP CONSTRAINT IF EXISTS reconciliation_results_status_check;

ALTER TABLE reconciliation_results
  ADD CONSTRAINT reconciliation_results_status_check CHECK (
    status IN (
      'Matched', 'Value Mismatch', 'Tax Type Mismatch', 'Tax Rate Mismatch',
      'In 2B Only', 'In PR Only', 'QRMP Delay', 'Suggested Match',
      'Duplicate', 'RCM Invoice', 'ITC Blocked', 'ITC Temporary',
      'Sec 16(4) Expired', 'Sec 16(4) Warning', 'POS Mismatch',
      'CESS Mismatch', 'Period Timing Mismatch',
      'Date Gap Match', 'Group Entity Match', 'GSTIN Mismatch Match',
      'Amount-Led Match', 'Consolidated Invoice Match', 'Probable Month Match',
      'Unclaimed ITC', 'ITC Eligibility Uncertain', 'Debit Note Misclassified',
      'Partially Booked ITC', 'ITC Reduced by Supplier', 'Non-GST Entry'
    )
  );
