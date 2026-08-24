# Kourier Boyz Seller Client

The client workspace combines two applications under one client-panel domain:

- `apps/logistics`: courier aggregation, shipment operations, billing, reconciliation, and integrations.
- `apps/marketplace`: optional marketplace seller onboarding, catalogue, inventory, orders, settlements, and storefront management.

The logistics application is served at `/`. The marketplace seller application is served at `/store/`. Running `npm run build` produces a combined static bundle in `seller-client/dist`.
