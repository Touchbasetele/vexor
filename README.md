# Vexor Procure OS

Production-oriented Node/Express procurement cockpit with a static dashboard, SQLite-backed cockpit data, and Knex-managed core API tables.

## Local Run

```bash
npm install
cp .env.example .env
npm run dev
```

The app listens on `http://localhost:3000` by default.

## Production Checklist

- Set `NODE_ENV=production`.
- Set `JWT_SECRET` to a random value with at least 32 characters.
- Set `DATABASE_URL` for the Knex-managed core API tables.
- Keep `AUTO_SEED` unset or `false` in production. Production startup refuses `AUTO_SEED=true`.
- Run `npm run migrate` during deploy, or leave `AUTO_MIGRATE=true` if your platform supports startup migrations.
- Restrict `CORS_ORIGIN` to the exact browser origins that should call the API, comma-separated when needed.
- Run `npm run smoke` against the deployed URL with `SMOKE_BASE_URL=https://your-app.example`.

## Useful Scripts

- `npm start`: start the production server.
- `npm run dev`: start with Node watch mode.
- `npm run check`: syntax-check server entrypoints.
- `npm run migrate`: run Knex migrations.
- `npm run seed`: seed dashboard demo data for local development.
- `npm run seed:core`: seed local auth/core tables.
- `npm run smoke`: verify health, bootstrap, and RFQ endpoints.
