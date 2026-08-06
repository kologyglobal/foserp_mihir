# Hostinger Git Deployment

This repository deploys as one Hostinger Node.js application:

- Express API from `backend/dist`
- Vite SPA generated from `frontend/src`
- Published SPA copied to `backend/public`
- Runtime entry: `backend/start.sh` (or `backend/hostinger-start.mjs`)

`frontend/dist`, `backend/dist`, and `backend/public` are generated during
deployment and remain gitignored. A Git pull alone is not a deployment.

## Hostinger directory layout (SSH)

Hostinger does **not** keep a `backend/` folder at runtime. With **Output directory = `backend`**, the **contents** of `backend/` are published to:

```text
~/domains/<your-domain>/nodejs/          ← runtime app (entry file, dist/, prisma/)
~/domains/<your-domain>/.builds/last-source/   ← full Git checkout (repo root)
```

Example for `stageapi.dhurandharcrm.com`:

```bash
# Runtime (start app, run migrate)
cd ~/domains/stageapi.dhurandharcrm.com/nodejs

# Full repo (re-run build manually)
cd ~/domains/stageapi.dhurandharcrm.com/.builds/last-source
```

If `nodejs/` is missing or empty, the Git deploy **build failed** — fix hPanel build settings and redeploy; do not guess paths under `~/`.

## Hostinger hPanel settings

In **Websites → Node.js Web App → Settings & Redeploy**:

| Setting | Value |
|---|---|
| Repository | `kologyglobal/foserp_mihir` |
| Branch | `main` |
| Project/root directory | repository root (`/`) |
| Framework | Other / Express |
| Node.js | **22.x** (set explicitly — do **not** use 24.x; esbuild/prisma break on Node 24) |
| Install command | `npm ci --prefix backend --omit=dev` (stage API) or `npm ci --prefix backend` (full build with scripts) |
| Build command | `npm run build --prefix backend` |
| Output directory | `backend` |
| Entry file | `start.sh` (preferred) or `hostinger-start.mjs` |

Required frontend build variables:

```text
VITE_USE_API=true
VITE_API_BASE_URL=/api/v1
VITE_TENANT_SLUG=vasant-trailers
```

**API-only hosts** (e.g. `stageapi.dhurandharcrm.com`): set `SKIP_FRONTEND=1` in
Environment Variables, or rely on auto-detect from deploy path. No Vite build runs;
frontend is served from the main stage/prod SPA host.

Backend database/JWT variables remain configured in Hostinger Environment
Variables. Never place their values in Git.

## Database migrations

Build does **not** run migrations by default (avoids blocking compile on DB errors).

| When | How |
|------|-----|
| **Startup** (recommended) | Set `RUN_MIGRATE_ON_START=1` in hPanel Runtime env — `hostinger-start.mjs` runs `migrate-deploy.mjs` before loading the server. |
| **Build time** | Set `RUN_MIGRATE_ON_BUILD=1` or use `npm run build:with-migrate` locally before deploy. |
| **SSH one-off** | `cd backend && npm run db:deploy:hostinger` |

Requires hPanel **`DB_HOST`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASS`**
(or `DATABASE_URL`) for **Build** (if migrate-on-build) and **Runtime**.

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
cd ~/domains/.../nodejs   # runtime app root (not .../backend)
export DB_HOST=127.0.0.1 DB_NAME=... DB_USER=... DB_PASS=...
npm run db:recover-known
npm run db:migrate:deploy
npx prisma migrate status --schema=./prisma/schema.prisma
```

Recovery verifies schema before updating `_prisma_migrations` (e.g. phase10 checks
that `productId` columns are gone). Then redeploy with **`npm run build`**.

Alternative when schema already matches `migration.sql`:

```bash
npx prisma migrate resolve --applied <migration_name>
npx prisma migrate deploy
```

Never use `prisma migrate reset` on live.

## Troubleshooting failed deploys

### `Could not find Prisma Schema`

Prisma was invoked outside `backend/` or the deploy tree is missing `backend/prisma/schema.prisma`.

1. hPanel **Project/root directory** must be the **repository root** (`/`), not `backend/`.
2. **Build command** must be `npm run build --prefix backend` (runs from repo root into `backend/`).
3. Redeploy after pushing the latest `backend/package.json` (`prisma.schema` + explicit `--schema` flags).

Do **not** paste npm error logs into SSH — run commands one at a time.

### `hostinger-start.mjs: Permission denied`

Hostinger executes the entry file directly (not via `node`). Use **`start.sh`** as the entry file, or after SSH:

```bash
chmod +x ~/domains/YOUR_DOMAIN/nodejs/start.sh
chmod +x ~/domains/YOUR_DOMAIN/nodejs/hostinger-start.mjs
```

### `npm error EUSAGE` / lock file out of sync during build

The build script **does not** run `npm ci` again. Hostinger Install must succeed once:

```text
npm ci --prefix backend --omit=dev
```

Commit `backend/package-lock.json` whenever `backend/package.json` changes.

### `esbuild` Expected 0.28.1 but got 0.25.12

Caused by **Node 24.x** and/or installing **devDependencies** (`tsx`) on the server. Fix:

1. hPanel Node.js → **22.x** (not 24.x)
2. Install → `npm ci --prefix backend --omit=dev` (skips tsx/vitest)

Deprecated `inflight` / `glob` warnings are harmless — ignore them.

### `npm error enoent` during deploy

Usually the **Install** or **Build** command path is wrong, or the Git build never finished.

1. Confirm `.builds/last-source/backend/package.json` exists after deploy.
2. hPanel **Install**: `npm ci --prefix backend` (from repo root in `.builds/last-source`).
3. hPanel **Build**: `npm run build --prefix backend`.
4. After a successful build, `nodejs/package.json` and `nodejs/dist/server.js` must exist.

Discover layout:

```bash
ls ~/domains/stageapi.dhurandharcrm.com/
ls ~/domains/stageapi.dhurandharcrm.com/nodejs/
ls ~/domains/stageapi.dhurandharcrm.com/.builds/last-source/
```

### Manual start (SSH)

```bash
cd ~/domains/stageapi.dhurandharcrm.com/nodejs
chmod +x start.sh hostinger-start.mjs
export DB_HOST=127.0.0.1 DB_NAME=YOUR_REAL_DB DB_USER=YOUR_REAL_USER DB_PASS='YOUR_REAL_PASS'
node hostinger-start.mjs
```

Use your **real** hPanel database name and user — not placeholder values.

## What the build does

`npm run build` in repo root calls `scripts/build-hostinger.mjs` (CI — no migrate).

Hostinger backend `npm run build` (`build-hostinger-deploy.mjs`):

1. `npm ci` in `backend/` (postinstall runs conditional `prisma generate` if schema changed)
2. Conditional prisma generate + esbuild compile → `backend/dist/` (skips generate when client is up to date)
3. Optional Vite frontend → `backend/public/` (skipped when `SKIP_FRONTEND=1` or stage API host)
4. Sets execute bit on `start.sh` / `hostinger-start.mjs`

Repo-root `npm run build` (GitHub CI) compiles frontend + backend via `build:app` — **no database access**.

Local backend compile without migrate: `npm run build:app`.

With `RUN_MIGRATE_ON_START=1`, startup logs must show:

```text
[migrate-deploy] Target database: user@host:3306/your_db
[migrate-deploy] Database schema is up to date.
```

The publish step occurs only after builds pass. Entry file `start.sh` loads
`hostinger-start.mjs`, which optionally migrates then imports `dist/server.js`.

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
