# WooCommerce Integration Runbook

This app connects WooCommerce through the current WooCommerce REST API:

- Orders are read from `/wp-json/wc/v3/orders`.
- Store credentials are verified against `/wp-json/wc/v3/system_status`.
- Order webhooks are registered or refreshed for `order.created`, `order.updated`, and `order.deleted`.
- Shipment status sync can update WooCommerce orders and add AWB notes when enabled on the connected store.

Official references:

- REST API setup and key generation: https://developer.woocommerce.com/docs/apis/rest-api/
- Current v3 webhook API and signature headers: https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/
- REST API technical reference: https://woocommerce.github.io/woocommerce-rest-api-docs/

## Merchant Setup

1. Sign in to WordPress admin.
2. Open WooCommerce > Settings > Advanced > REST API.
3. Click Create an API key or Add Key.
4. Set Description to `Kourier Boyz`.
5. Select the WordPress user that owns/administers the store.
6. Set Permissions to `Read/Write`.
7. Click Generate API Key.
8. Copy the Consumer Key and Consumer Secret immediately.

The key normally starts with `ck_`. The secret normally starts with `cs_`.

## Backend Configuration

For production webhook auto-registration, `API_URL` must be a public HTTPS backend URL that WooCommerce can reach.
Do not include `/api` in this value.

Example:

```bash
API_URL=https://api.kourierboyz.com
```

The app will register this webhook delivery URL:

```text
https://api.kourierboyz.com/api/webhook/woocommerce/orders
```

Optional:

```bash
PLATFORM_API_TIMEOUT_MS=15000
WOOCOMMERCE_WEBHOOK_SECRET=
```

Leave `WOOCOMMERCE_WEBHOOK_SECRET` empty unless you intentionally want one shared fallback. The normal connect flow generates and stores a per-store webhook secret.

## Backend Endpoints

All integration routes require the authenticated merchant session.

Connect or update a WooCommerce store:

```http
POST /api/integrations/woocommerce-auth
```

```json
{
  "storeUrl": "https://yourstore.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "settings": {
    "autoUpdateStatus": true,
    "autoUpdateShipmentStatus": true,
    "markCodPaid": false
  }
}
```

Sync recent orders on demand:

```http
POST /api/integrations/woocommerce/sync-orders
```

```json
{
  "limit": 100,
  "storeId": "woo_optional_store_id"
}
```

Webhook receiver registered in WooCommerce:

```http
POST /api/webhook/woocommerce/orders
```

## Credential Check

Run the built-in mock proof:

```bash
npm run check:woocommerce-apis -- --mock
```

Run against a real WooCommerce store:

```bash
WOOCOMMERCE_STORE_URL=https://yourstore.com \
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
npm run check:woocommerce-apis
```

On PowerShell:

```powershell
$env:WOOCOMMERCE_STORE_URL="https://yourstore.com"
$env:WOOCOMMERCE_CONSUMER_KEY="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:WOOCOMMERCE_CONSUMER_SECRET="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
npm run check:woocommerce-apis
```

The command proves these pieces:

- REST credentials authenticate successfully.
- Store metadata can be read.
- Recent orders can be fetched.
- Webhooks can be listed.

To prove Read/Write permission before using production, run this on a staging store or during a planned test window:

```bash
WOOCOMMERCE_CHECK_WRITE=true npm run check:woocommerce-apis
```

That creates a paused test webhook and deletes it immediately.

## App Test Flow

1. In the client, open Channels or Integrations.
2. Select WooCommerce.
3. Paste Store URL, Consumer Key, and Consumer Secret.
4. Click Connect.
5. Open Connected Stores.
6. Click Sync Orders.
7. Confirm WooCommerce orders appear in B2C orders with `integration_type = woocommerce`.

If connection succeeds but webhook setup warns, check that `API_URL` is public HTTPS and not blocked by firewall, Cloudflare, or basic auth.

## Deployment Checklist

1. Set `API_URL` in the backend environment to the public HTTPS backend origin.
2. Run `npm run build` from `backend`.
3. Run `npm run check:woocommerce-apis -- --mock` from `backend`.
4. With merchant credentials available, run the real credential check.
5. Connect the store from the app and confirm the response includes webhook subscriptions.
6. Sync orders once from Connected Stores.
7. Confirm imported WooCommerce orders appear in B2C orders with `integration_type = woocommerce`.
