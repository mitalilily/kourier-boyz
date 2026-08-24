ALTER TABLE invoice_preferences
  ADD COLUMN IF NOT EXISTS seller_name varchar(255),
  ADD COLUMN IF NOT EXISTS brand_name varchar(255),
  ADD COLUMN IF NOT EXISTS gst_number varchar(32),
  ADD COLUMN IF NOT EXISTS pan_number varchar(32),
  ADD COLUMN IF NOT EXISTS seller_address text,
  ADD COLUMN IF NOT EXISTS state_code varchar(10),
  ADD COLUMN IF NOT EXISTS support_email varchar(150),
  ADD COLUMN IF NOT EXISTS support_phone varchar(50),
  ADD COLUMN IF NOT EXISTS invoice_notes text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;
