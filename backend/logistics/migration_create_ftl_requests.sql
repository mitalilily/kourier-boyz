CREATE TABLE IF NOT EXISTS ftl_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  request_number varchar(60) NOT NULL UNIQUE,
  customer_name varchar(160) NOT NULL,
  customer_phone varchar(30) NOT NULL,
  customer_email varchar(160),
  company_name varchar(180),
  origin_city varchar(120) NOT NULL,
  origin_state varchar(120),
  origin_pincode varchar(20) NOT NULL,
  origin_address text,
  destination_city varchar(120) NOT NULL,
  destination_state varchar(120),
  destination_pincode varchar(20) NOT NULL,
  destination_address text,
  vehicle_type varchar(120) NOT NULL,
  material_type varchar(160) NOT NULL,
  weight_kg numeric,
  truck_count numeric DEFAULT 1,
  loading_date timestamptz,
  notes text,
  status varchar(50) NOT NULL DEFAULT 'requested',
  awb_number varchar(100),
  processed_date timestamptz,
  admin_notes text,
  form_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ftl_requests_user_id_idx ON ftl_requests(user_id);
CREATE INDEX IF NOT EXISTS ftl_requests_status_idx ON ftl_requests(status);
CREATE INDEX IF NOT EXISTS ftl_requests_created_at_idx ON ftl_requests(created_at DESC);
