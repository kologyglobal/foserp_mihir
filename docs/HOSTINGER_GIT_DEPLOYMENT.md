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
| Build command | `npm run build` |
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

Pending migrations apply in **two** places (same script: `backend/scripts/migrate-deploy.mjs`):

1. **During `npm run build`** — after `backend/npm ci`, before Vite/backend compile.
   Build logs must show:
   ```text
   Applying pending Prisma migrations against deploy database
   [migrate-deploy] Target database: user@host:3306/your_db
   [migrate-deploy] Database schema is up to date.
   ```
2. **On app restart** — `hostinger-start.mjs` runs migrate again before loading
   `dist/server.js` (safety net if build skipped migrate).

Requires hPanel **`DB_HOST`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASS`**
(or `DATABASE_URL`) to be set for **Build** and **Runtime** — not only runtime.

Emergency bypass (manual SQL already applied):

```text
RUN_MIGRATE_ON_BUILD=false
RUN_MIGRATE_ON_START=false
```

If migrate is **Killed** during build, use **GitHub Actions → Database migrate**
(with `STAGE_DB_*` / `PROD_DB_*` secrets) or phpMyAdmin:
`backend/scripts/live-deploy-receiving-tolerance-master.sql` and peers under
`backend/scripts/live-deploy-*.sql`.

## What the build does

`npm run build` calls `scripts/build-hostinger.mjs`:

1. `npm ci` in `frontend/`
2. `npm ci` in `backend/`
3. Builds Vite in API mode
4. Generates Prisma client and compiles the backend
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
