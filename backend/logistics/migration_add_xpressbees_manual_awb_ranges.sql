CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS xpressbees_awb_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_awb varchar(64) NOT NULL,
  end_awb varchar(64) NOT NULL,
  next_awb varchar(64) NOT NULL,
  last_allocated_awb varchar(64),
  status varchar(24) NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  exhausted_at timestamptz,
  CONSTRAINT xpressbees_awb_ranges_status_check
    CHECK (status IN ('active', 'exhausted', 'retired')),
  CONSTRAINT xpressbees_awb_ranges_numeric_check
    CHECK (
      start_awb ~ '^[0-9]+$'
      AND end_awb ~ '^[0-9]+$'
      AND next_awb ~ '^[0-9]+$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS xpressbees_awb_ranges_one_active_idx
  ON xpressbees_awb_ranges (is_active)
  WHERE is_active = true AND status = 'active';

CREATE INDEX IF NOT EXISTS xpressbees_awb_ranges_status_idx
  ON xpressbees_awb_ranges (status, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS xpressbees_awb_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  range_id uuid NOT NULL REFERENCES xpressbees_awb_ranges(id),
  awb_number varchar(64) NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'reserved',
  order_number varchar(100),
  local_order_id uuid,
  user_id uuid,
  provider_reference varchar(120),
  failure_reason text,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  failed_at timestamptz,
  CONSTRAINT xpressbees_awb_allocations_status_check
    CHECK (status IN ('reserved', 'used', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS xpressbees_awb_allocations_range_status_idx
  ON xpressbees_awb_allocations (range_id, status);

CREATE INDEX IF NOT EXISTS xpressbees_awb_allocations_order_number_idx
  ON xpressbees_awb_allocations (order_number);
