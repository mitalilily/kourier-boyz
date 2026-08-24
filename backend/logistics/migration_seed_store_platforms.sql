-- Ensure connected-store platform IDs are present before channel integrations run.
INSERT INTO "platforms" ("id", "name", "slug")
VALUES
  (1, 'Shopify', 'shopify'),
  (2, 'WooCommerce', 'woocommerce'),
  (3, 'Amazon', 'amazon'),
  (4, 'Magento', 'magento'),
  (5, 'Wix', 'wix')
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug";
