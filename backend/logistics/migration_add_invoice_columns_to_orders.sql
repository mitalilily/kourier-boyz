ALTER TABLE b2c_orders
  ADD COLUMN IF NOT EXISTS invoice_number varchar(100),
  ADD COLUMN IF NOT EXISTS invoice_date varchar(50),
  ADD COLUMN IF NOT EXISTS invoice_amount numeric,
  ADD COLUMN IF NOT EXISTS invoice_link varchar(300);

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS invoice_number varchar(100),
  ADD COLUMN IF NOT EXISTS invoice_date varchar(50),
  ADD COLUMN IF NOT EXISTS invoice_amount numeric,
  ADD COLUMN IF NOT EXISTS invoice_link varchar(300);
