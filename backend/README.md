# Kourier Boyz Backend

This workspace keeps the marketplace and logistics domains independently reliable while exposing them as one Kourier Boyz platform.

- `marketplace`: MongoDB-backed catalogue, inventory, storefront, marketplace orders, buyers, sellers, and settlements.
- `logistics`: PostgreSQL-backed courier aggregation, shipments, rates, wallet, COD, NDR/RTO, reconciliation, and channel integrations.

The services use separate databases and ports. Production routing should expose them behind the Kourier Boyz API domain without sharing credentials or database connections.
