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

## What the build does

`npm run build` calls `scripts/build-hostinger.mjs`:

1. `npm ci` in `frontend/`
2. `npm ci` in `backend/`
3. Builds Vite in API mode
4. Generates Prisma client and compiles the backend
5. Copies `frontend/dist` to `backend/public`
6. Writes `backend/public/build-meta.json` with the deployed Git revision

The publish step occurs only after both builds pass. `npm start` launches
`backend/hostinger-start.mjs`, which refuses to start if either build output is
missing.

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
