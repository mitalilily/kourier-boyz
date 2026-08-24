-- Reliability-focused indexes for high-traffic lookup and pagination paths.
-- Run during a low-traffic window if your migration runner wraps statements in a transaction.

CREATE INDEX IF NOT EXISTS idx_b2c_orders_user_created_at
  ON b2c_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2c_orders_user_status_created_at
  ON b2c_orders (user_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2c_orders_awb_number
  ON b2c_orders (awb_number);

CREATE INDEX IF NOT EXISTS idx_b2c_orders_updated_at
  ON b2c_orders (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_user_created_at
  ON b2b_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_user_status_created_at
  ON b2b_orders (user_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_awb_number
  ON b2b_orders (awb_number);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_updated_at
  ON b2b_orders (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndr_events_user_created_at
  ON ndr_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndr_events_awb_created_at
  ON ndr_events (awb_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndr_events_order_created_at
  ON ndr_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rto_events_user_created_at
  ON rto_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rto_events_awb_created_at
  ON rto_events (awb_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rto_events_order_created_at
  ON rto_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order_created_at
  ON tracking_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_awb_created_at
  ON tracking_events (awb_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_active
  ON webhook_subscriptions (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_next_retry
  ON webhook_deliveries (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription_created
  ON webhook_deliveries (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created_at
  ON wallet_transactions (wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stores_user_id
  ON stores ("userId");

CREATE INDEX IF NOT EXISTS idx_locations_pincode_city_state_country
  ON kourier_boyz_locations (pincode, city, state, country);

CREATE INDEX IF NOT EXISTS idx_zone_mappings_zone_location
  ON kourier_boyz_zone_mappings (zone_id, location_id);

CREATE INDEX IF NOT EXISTS idx_b2b_pincodes_zone_state_pincode
  ON kourier_boyz_b2b_pincodes (zone_id, state, pincode);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_lookup
  ON shipping_rates (courier_id, plan_id, business_type, zone_id, type, mode, service_provider);

CREATE INDEX IF NOT EXISTS idx_shipping_rate_slabs_shipping_rate_id
  ON shipping_rate_slabs (shipping_rate_id);
