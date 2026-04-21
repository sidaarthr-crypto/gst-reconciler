-- Allow new reconciliation result status values from the enhanced engine.
ALTER TABLE reconciliation_results
  DROP CONSTRAINT IF EXISTS reconciliation_results_status_check;

ALTER TABLE reconciliation_results
  ADD CONSTRAINT reconciliation_results_status_check
  CHECK (status IN (
    'Matched',
    'Value Mismatch',
    'Tax Type Mismatch',
    'Suggested Match',
    'In 2B Only',
    'In PR Only',
    'Duplicate',
    'RCM Invoice'
  ));
