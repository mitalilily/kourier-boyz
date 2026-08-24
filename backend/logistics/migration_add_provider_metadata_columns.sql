ALTER TABLE b2c_orders
  ADD COLUMN IF NOT EXISTS provider_reference varchar(120),
  ADD COLUMN IF NOT EXISTS provider_request_id varchar(120),
  ADD COLUMN IF NOT EXISTS provider_mode varchar(50),
  ADD COLUMN IF NOT EXISTS provider_service varchar(50),
  ADD COLUMN IF NOT EXISTS provider_last_status varchar(80),
  ADD COLUMN IF NOT EXISTS provider_meta jsonb;

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS integration_type varchar(50),
  ADD COLUMN IF NOT EXISTS provider_reference varchar(120),
  ADD COLUMN IF NOT EXISTS provider_request_id varchar(120),
  ADD COLUMN IF NOT EXISTS provider_mode varchar(50),
  ADD COLUMN IF NOT EXISTS provider_service varchar(50),
  ADD COLUMN IF NOT EXISTS provider_last_status varchar(80),
  ADD COLUMN IF NOT EXISTS provider_meta jsonb;
