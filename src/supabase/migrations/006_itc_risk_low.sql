-- Allow ITC risk "Low" (e.g. cross-period QRMP timing) on reconciliation_results.
ALTER TABLE public.reconciliation_results
  DROP CONSTRAINT IF EXISTS reconciliation_results_itc_risk_check;

ALTER TABLE public.reconciliation_results
  ADD CONSTRAINT reconciliation_results_itc_risk_check
  CHECK (
    itc_risk IN (
      'Safe',
      'Low',
      'Medium',
      'High',
      'Critical'
    )
  );
