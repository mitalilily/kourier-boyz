CREATE TABLE IF NOT EXISTS courier_registration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  provider varchar(50) NOT NULL,
  operation varchar(50) NOT NULL,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  pickup_address_id uuid REFERENCES pickup_addresses(id) ON DELETE SET NULL,
  warehouse_alias varchar(255),
  error_code varchar(100),
  error_message text NOT NULL,
  error_payload jsonb,
  request_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
