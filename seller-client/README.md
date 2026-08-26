# Kourier Boyz Seller Client

The client workspace combines two applications under one client-panel domain:

- `apps/logistics`: courier aggregation, shipment operations, billing, reconciliation, and integrations.
- `apps/marketplace`: optional marketplace seller onboarding, catalogue, inventory, orders, settlements, and storefront management.

The logistics application is served at `/`. The marketplace seller application is served at `/store/`. Running `npm run build` produces a combined static bundle in `seller-client/dist`.

## Render SPA routing

The repository root includes `render.yaml` with the required rewrites for the combined static site. If the Render service was created manually instead of from the Blueprint, add these rewrite rules in the service's **Redirects/Rewrites** settings:

- `/store` -> `/store/index.html`
- `/store/*` -> `/store/index.html`
- `/*` -> `/index.html`

Keep the `/store/*` rules above the catch-all rule. Render serves existing asset files before applying rewrites, so marketplace JavaScript, CSS, and images continue to load normally.
