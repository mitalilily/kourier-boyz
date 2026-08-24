# Kourier Boyz Unified Backend

The backend deploys as one Node.js service backed by one PostgreSQL database.

- Courier and logistics routes remain under `/api/*`.
- Marketplace routes are exposed under `/api/marketplace/*`.
- Both modules share one HTTP server, Socket.IO server, process, port, and PostgreSQL service.
- Existing marketplace ObjectId strings, Mongoose validation, hooks, population, controllers, seeds, and scripts remain compatible through the PostgreSQL persistence adapter.

## Commands

```bash
npm run railway:build
npm run render:build
npm run migrate
npm test
npm start
```

Render should use `/backend` as the service root, `npm run render:build` as the build command, `npm run migrate` as the pre-deploy command, and `npm start` as the start command. Railway can continue using `npm run railway:build`. The healthcheck path is `/health`.

The default `npm run build` command is also deployment-safe: it installs both child service dependency trees, including TypeScript development dependencies, before compiling them.

## Existing Marketplace Data

Set `SOURCE_MONGO_URI`, `SOURCE_MONGO_DATABASE`, and `DATABASE_URL`, then run the one-time import:

```bash
npm run migrate:mongo-to-postgres --prefix marketplace
```

The import is idempotent by collection and document ID. It preserves ObjectId values and source unique indexes. Run it before directing production traffic to the unified backend.

All marketplace and logistics seed commands remain in their respective package files. Seeds that create data should be run once after migrations, not as part of every deployment.
