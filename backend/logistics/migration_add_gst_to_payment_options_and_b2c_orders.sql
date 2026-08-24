-- ============================================================
-- Add GST setting and B2C wallet debit tax columns
-- ============================================================
-- payment_options.gst_percent controls the GST percentage applied
-- to seller courier wallet debit. Existing stores start at 0%.
-- ============================================================

ALTER TABLE payment_options
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(6, 2) DEFAULT '0';

UPDATE payment_options
SET gst_percent = '0'
WHERE gst_percent IS NULL;

ALTER TABLE payment_options
  ALTER COLUMN gst_percent SET DEFAULT '0',
  ALTER COLUMN gst_percent SET NOT NULL;

ALTER TABLE b2c_orders
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(6, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS wallet_debit_amount NUMERIC(12, 2) DEFAULT '0';

UPDATE b2c_orders
SET
  gst_percent = COALESCE(gst_percent, '0'),
  gst_amount = COALESCE(gst_amount, '0'),
  wallet_debit_amount = COALESCE(wallet_debit_amount, '0')
WHERE gst_percent IS NULL
  OR gst_amount IS NULL
  OR wallet_debit_amount IS NULL;

-- ============================================================
-- Verify:
-- SELECT gst_percent FROM payment_options LIMIT 1;
-- SELECT gst_percent, gst_amount, wallet_debit_amount FROM b2c_orders LIMIT 5;
-- ============================================================
