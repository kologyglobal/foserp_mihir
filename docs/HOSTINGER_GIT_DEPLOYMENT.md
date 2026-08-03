# Hostinger Git Deployment

This repository deploys as one Hostinger Node.js application:

- Express API from `backend/dist`
- Vite SPA generated from `frontend/src`
- Published SPA copied to `backend/public`
- Runtime entry: `backend/hostinger-start.mjs`

`frontend/dist`, `backend/dist`, and `backend/public` are generated during
deployment and remain gitignored. A Git pull alone is not a deployment.

## Hostinger hPanel settings

In **Websites → Node.js Web App → Settings & Redeploy**:

| Setting | Value |
|---|---|
| Repository | `kologyglobal/foserp_mihir` |
| Branch | `main` |
| Project/root directory | repository root (`/`) |
| Framework | Other / Express |
| Node.js | 22.x (20.x minimum) |
| Install command | `npm ci` |
| Build command | `npm run build` (backend `package.json` — Hostinger dropdown) |
| Output directory | `backend` |
| Entry file | `hostinger-start.mjs` |

Required frontend build variables:

```text
VITE_USE_API=true
VITE_API_BASE_URL=/api/v1
VITE_TENANT_SLUG=vasant-trailers
```

Backend database/JWT variables remain configured in Hostinger Environment
Variables. Never place their values in Git.

## Database migrations (automatic)

Pending migrations run during **backend `npm run build`** (Hostinger dropdown):

1. `prisma migrate deploy` via `backend/scripts/migrate-deploy.mjs`
2. `prisma generate` + TypeScript compile

Build logs must show:

```text
[migrate-deploy] Target database: user@host:3306/your_db
[migrate-deploy] Database schema is up to date.
```

Repo-root `npm run build` (GitHub CI) compiles frontend + backend via `build:app` — **no database access**.

Local backend compile without migrate: `npm run build:app`.

Requires hPanel **`DB_HOST`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASS`**
(or `DATABASE_URL`) for **Build** and **Runtime**.

### Failed legacy migrations (one-time)

Prisma **P3009** blocks deploy until the failed row is reconciled once.

**Where to run recovery**

| Route | When to use |
|-------|-------------|
| **Hostinger SSH** | `DB_HOST=127.0.0.1` in hPanel — MySQL is on the same server. Run inside the deployed `backend/` folder. |
| **phpMyAdmin** | SSH unavailable, or SSH shell lacks `DB_*` env vars. Paste `backend/scripts/live-fix-p3018-crm-phase10-drop-product-id.sql`. |
| **Your PC** | Only if Hostinger **Remote MySQL** is enabled and you use the **remote hostname** — not `127.0.0.1`. |

`127.0.0.1` from your PC is your own machine, not Hostinger.

**SSH sequence** (export `DB_*` in the shell if hPanel vars are not injected):

```bash
cd ~/domains/.../backend   # deployed backend path
export DB_HOST=127.0.0.1 DB_NAME=... DB_USER=... DB_PASS=...
npm run db:recover-known
npm run db:migrate:deploy
npx prisma migrate status
```

Recovery verifies schema before updating `_prisma_migrations` (e.g. phase10 checks
that `productId` columns are gone). Then redeploy with **`npm run build`**.

Alternative when schema already matches `migration.sql`:

```bash
npx prisma migrate resolve --applied <migration_name>
npx prisma migrate deploy
```

Never use `prisma migrate reset` on live.

## What the build does

`npm run build` in repo root calls `scripts/build-hostinger.mjs` (CI — no migrate).

Hostinger backend `npm run build` calls migrate + compile directly.

1. `npm ci` in `frontend/` and `backend/` (root build only)
2. Vite frontend build
3. Backend `build:app` (root CI) or `build` = migrate + compile (Hostinger)
5. Copies `frontend/dist` to `backend/public`
6. Writes `backend/public/build-meta.json` with the deployed Git revision

Step 2b (after backend `npm ci`): **`migrate deploy`** against the deploy DB.

The publish step occurs only after builds pass and migrations succeed. `npm start`
launches `backend/hostinger-start.mjs`, which runs migrate again then loads
`dist/server.js`.

## Verification after every deployment

The deployment log must include:

```text
Hostinger build complete for revision <main SHA>
Published SPA: .../backend/public
```

Then verify:

```text
GET https://erp.dhurandharcrm.com/build-meta.json
GET https://erp.dhurandharcrm.com/api/v1/health
```

`build-meta.json.revision` must equal `git rev-parse origin/main`. View page
source and confirm its `/assets/index-*.js` hash changed when frontend source
changed.

Local/CI parity check:

```bash
npm ci
npm run build
npm run verify:deployment
```

## Important

- Do not commit `frontend/dist` or `backend/public`.
- Do not deploy from `deploy/FINAL-UPLOAD` or `release/fos-erp-host`; those are
  historical packaging paths and can contain stale frontend assets.
- GitHub Actions validates the same root build but does not publish production;
  Hostinger's GitHub integration performs the deployment.
