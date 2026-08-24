CREATE TABLE IF NOT EXISTS kourier_boyz_international_country_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name varchar(160) NOT NULL,
  country_key varchar(180) NOT NULL UNIQUE,
  zone_code varchar(20) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kourier_boyz_international_rates
  ALTER COLUMN destination_country TYPE varchar(120),
  ADD COLUMN IF NOT EXISTS destination_zone varchar(20);
