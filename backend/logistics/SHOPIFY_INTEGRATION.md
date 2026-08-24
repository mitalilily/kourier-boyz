# Shopify OAuth Integration Runbook

This backend connects Shopify stores through the Shopify OAuth authorization code grant and then uses the GraphQL Admin API with the stored offline access token.

## Token Mode Decision

Use one **offline OAuth access token per connected Shopify store**.

This is the correct mode for Kourier Boyz because many independent merchants connect their own stores from the client panel, and Kourier Boyz must continue to work when the merchant is not actively logged in:

- Shopify order webhooks must be accepted at any time.
- Scheduled/manual order sync must run in the background.
- Shipment booking can trigger Shopify fulfillment, tag, payment, or cancellation updates after the original install session.
- A store connection belongs to the merchant's store, not to one Shopify staff member's browser session.

Do not use Shopify online access tokens for this workflow. Online tokens are tied to an individual Shopify user/session and are not suitable for background order-to-shipment automation.

Do not use client credentials as the main merchant install flow. That grant is for trusted server-to-server cases, not a multi-merchant SaaS flow where each merchant authorizes their own store.

The current implementation requests an expiring offline token by sending `expiring=1` when exchanging Shopify's authorization code. The access token, refresh token, access-token expiry, and refresh-token expiry are stored under `stores.metadata.oauth`, and background Shopify API calls refresh the token before it expires.

`SHOPIFY_USE_EXPIRING_OFFLINE_TOKENS=false` can be used only for compatibility testing with custom apps that are not subject to the public-app requirement. Do not disable expiring offline tokens for Kourier Boyz's public multi-merchant OAuth flow.

The OAuth flow intentionally requires `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. Legacy aliases such as `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and stored Admin API tokens are not used for OAuth.

Official references:

- Authorization code grant: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
- Offline access tokens: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
- GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql/latest
- Webhooks: https://shopify.dev/docs/apps/build/webhooks
- Legacy custom app cutoff: https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026

## Required Shopify App Setup

Create one Kourier Boyz app from the Shopify Dev Dashboard. The Shopify app's client ID and client secret belong to Kourier Boyz, not to each merchant. Every merchant installs this same app, and Shopify returns a separate store access token for each connected store.

Configure the app URL:

```text
https://api.kourierboyz.com/api/integrations/shopify/oauth/install
```

That install URL now hands new merchants to a public Kourier Boyz bootstrap page at `/shopify/install`, which starts Shopify OAuth without requiring an existing Kourier Boyz login and then exchanges a short-lived bootstrap token after Shopify redirects back.

The live Shopify app configuration should be embedded and should point its `application_url` at the production seller-client origin, not at the backend install endpoint. After changing `seller-client/apps/logistics/shopify.app.toml`, deploy the app config to Shopify so the dashboard sees the updated embedded setting.

Configure the allowed redirection URL:

```text
https://api.kourierboyz.com/api/integrations/shopify/oauth/callback
```

For local testing, use a public HTTPS tunnel for the backend and add that callback too:

```text
https://your-ngrok-domain.ngrok-free.app/api/integrations/shopify/oauth/callback
```

## Backend Configuration

`API_URL` must be the public backend origin and must not include `/api`.

```bash
API_URL=https://api.kourierboyz.com
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_BOOTSTRAP_SECRET=optional_shared_secret_for_public_install_bootstrap
SHOPIFY_SCOPES=read_orders,write_orders,read_customers,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders
SHOPIFY_API_VERSION=2026-04
SHOPIFY_OAUTH_SUCCESS_URL=https://seller.kourierboyz.com/channels/connected
SHOPIFY_SEND_OAUTH_SCOPE=false
```

The OAuth callback path defaults to:

```text
/api/integrations/shopify/oauth/callback
```

The public install handoff path for the Shopify app URL is:

```text
/api/integrations/shopify/oauth/install
```

The public bootstrap exchange route is:

```text
/api/integrations/shopify/oauth/bootstrap
```

The Shopify app config lives in `seller-client/apps/logistics/shopify.app.toml`. It declares app-specific webhooks for both order events and mandatory privacy compliance events:

```text
orders/create, orders/updated, orders/cancelled
customers/data_request, customers/redact, shop/redact
```

Shopify signs OAuth callbacks and webhook deliveries with `SHOPIFY_CLIENT_SECRET`.

## Required Scopes

Use the least privileges possible for the features enabled:

- `read_orders` to import recent orders.
- `write_orders` to update order tags, cancel orders, and mark COD orders as paid.
- `read_customers` when customer data is needed for shipping.
- `read_merchant_managed_fulfillment_orders` and `write_merchant_managed_fulfillment_orders` when reading fulfillment orders and creating Shopify fulfillments.
- `read_all_orders` only if older-than-60-days order import is required and approved by Shopify.

Protected customer data must also be approved/configured in Shopify for buyer name, email, phone, shipping address, and billing address. Without that access, Shopify can hide address details in Admin API responses.

## Runtime Flow

1. Client enters `mystore.myshopify.com` in Kourier Boyz.
2. Client calls `POST /api/integrations/shopify/oauth/start`.
3. Backend returns a Shopify authorization URL.
4. Browser redirects to Shopify for merchant approval.
5. Shopify redirects to `GET /api/integrations/shopify/oauth/callback`.
6. Backend verifies Shopify HMAC and the signed state.
7. Backend exchanges `code` for an offline Admin API access token.
8. Backend probes the shop, saves the store, and redirects to the Kourier Boyz channels page.

When a merchant starts from Shopify instead of Kourier Boyz, Shopify opens the app URL with a `shop` query. Kourier Boyz redirects that merchant to the client panel, keeps the `shop` value, and continues the same OAuth flow after the merchant logs in.

Because the Shopify app version uses managed install (`Use legacy install flow = false`) and declares access scopes in Shopify app config, Kourier Boyz omits the OAuth `scope` query parameter by default. Set `SHOPIFY_SEND_OAUTH_SCOPE=true` only for a legacy/manual OAuth setup where Shopify app config is not managing scopes.

The manual credential endpoint `POST /api/integrations/shopify-auth` and the configured custom-app endpoint `POST /api/integrations/shopify/connect-env` now return HTTP `410` unless `SHOPIFY_ALLOW_LEGACY_MANUAL_AUTH=true` is explicitly set.

## API Endpoints

- `POST /api/integrations/shopify/oauth/start`
- `GET /api/integrations/shopify/oauth/callback`
- `PUT /api/integrations/shopify/settings`
- `POST /api/integrations/shopify/sync-orders`
- `GET /api/integrations/shopify/test-connection`

Example OAuth start payload:

```json
{
  "shop": "mystore.myshopify.com",
  "returnTo": "/channels/connected"
}
```

Example settings update payload:

```json
{
  "storeId": "123456789",
  "settings": {
    "fulfillTrigger": "order_booked",
    "customerNotifyOnFulfill": "notify",
    "autoUpdateShipmentStatus": true,
    "autoCancelOrders": true,
    "markCodPaidOnDelivery": true,
    "orderTagsToFetch": "",
    "codTags": "cod",
    "prepaidTags": "prepaid"
  }
}
```

## Verification Checklist

Run local builds first:

```bash
cd backend && npm run build
npm run check:shopify-oauth -- --mock
cd ../../seller-client/apps/logistics && npm run build
```

On production, after the Shopify Dev Dashboard credentials are present, run:

```bash
cd backend
NODE_ENV=production npm run check:shopify-oauth -- --require-public --shop=your-store.myshopify.com
```

Then test with a real Shopify development store:

1. Start the backend with public `API_URL`, Shopify client id, and Shopify client secret.
2. Start the client with `VITE_API_URL` pointing to the backend `/api` base.
3. Log in to Kourier Boyz as a merchant.
4. Go to `/channels/connected`.
5. Click Shopify, enter the `myshopify.com` domain, and approve the app in Shopify.
6. Confirm the Kourier Boyz channels page shows the Shopify success toast and a connected store row.
7. If the install began from Shopify admin before login, confirm the public bootstrap page on `/shopify/install` completes and signs the merchant in without a blank screen or auth dead-end.
8. In Shopify, create a test order with a shipping address.
9. Wait for the Shopify order webhook or click `Sync Orders` from Kourier Boyz.
10. Confirm the order appears in Kourier Boyz B2C orders with customer/address data.
11. Book a shipment from the Kourier Boyz panel.
12. Confirm the shipment is created with a courier AWB/label.
13. If auto fulfillment is enabled, confirm Shopify receives the fulfillment/status update.

If order address fields are missing during step 9, re-check protected customer data approval and the app scopes in the Shopify Dev Dashboard.

## Installation Audit Log

Production writes a dedicated JSON Lines audit trail to the configured persistent service filesystem path:

```text
logs/shopify-install-audit.jsonl
```

Each line contains only installation stage, pass/fail status, timestamp, request ID, shop domain, duration, and a sanitized error category. Shopify session tokens, Admin API tokens, refresh tokens, HMAC values, app secrets, and customer data are never recorded. The file rotates to `.1` at 10 MB, and an audit-write failure never blocks installation.

Follow a review attempt live:

```bash
tail -f logs/shopify-install-audit.jsonl
```

Show failures only:

```bash
jq -c 'select(.status == "failed")' logs/shopify-install-audit.jsonl
```
