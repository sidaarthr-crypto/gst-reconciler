-- Set guest free-tier reconciliation cap to 15.
INSERT INTO app_config (key, value, description)
VALUES (
  'free_tier_max_reconciliations',
  '15',
  'Number of free reconciliations allowed for guest users before signup is required'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;
