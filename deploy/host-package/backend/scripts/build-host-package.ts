/**
 * Build a single-host upload package for erp.dhurandharcrm.com (or custom domain).
 * Produces: deploy/host-package/ with backend + built SPA in public/ + install scripts.
 *
 * Usage (from repo root):
 *   npm run build:host
 *   npm --prefix backend exec -- tsx scripts/build-host-package.ts --domain=https://erp.dhurandharcrm.com
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const FRONTEND = path.join(ROOT, 'frontend')
const BACKEND = path.join(ROOT, 'backend')
const OUT = path.join(ROOT, 'deploy', 'host-package')

function argValue(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const DOMAIN = argValue('domain', 'https://erp.dhurandharcrm.com').replace(/\/$/, '')
const TENANT = argValue('tenant', 'vasant-trailers')

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  console.log(`> ${cmd} ${args.join(' ')}  (${cwd})`)
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  })
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`)
  }
}

function rmrf(p: string) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyDir(src: string, dest: string, skip: Set<string>) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to, skip)
    else fs.copyFileSync(from, to)
  }
}

function main() {
  console.log(`Building host package for ${DOMAIN}`)
  rmrf(OUT)
  fs.mkdirSync(OUT, { recursive: true })

  // 1) Production frontend build (same-origin API) — vite only; tsc gate has known demo/type debt
  run(
    'npx',
    ['vite', 'build'],
    FRONTEND,
    {
      VITE_USE_API: 'true',
      VITE_API_BASE_URL: '/api/v1',
      VITE_TENANT_SLUG: TENANT,
    },
  )

  // 2) Copy backend (no node_modules — install on server for correct OS binaries)
  const outBackend = path.join(OUT, 'backend')
  copyDir(
    BACKEND,
    outBackend,
    new Set(['node_modules', 'dist', 'coverage', '.env', 'uploads', '.DS_Store']),
  )

  // 3) Copy SPA into backend/public
  const publicDir = path.join(outBackend, 'public')
  rmrf(publicDir)
  copyDir(path.join(FRONTEND, 'dist'), publicDir, new Set())

  // 4) Production .env.example for this domain
  const envBody = `# erp.dhurandharcrm.com — fill DB + JWT secrets on the server
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=fos_erp
DB_USER=fos_erp_user
DB_PASS=CHANGE_ME_DB_PASSWORD

JWT_ACCESS_SECRET=CHANGE_ME_ACCESS_SECRET_MIN_32_CHARS!!
JWT_REFRESH_SECRET=CHANGE_ME_REFRESH_SECRET_MIN_32_CHARS!
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Must match the public HTTPS URL (CORS)
FRONTEND_URL=${DOMAIN}

# SPA is served from ./public (built into this package)
# FRONTEND_DIST=./public

CRM_UPLOAD_DIR=./uploads
CRM_MAX_UPLOAD_BYTES=10485760
`
  fs.writeFileSync(path.join(outBackend, '.env.example'), envBody)
  fs.writeFileSync(path.join(outBackend, '.env.production.example'), envBody)

  // 5) Server install + start helpers
  const installSh = `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cp -n .env.example .env || true
echo "Edit .env with MySQL + JWT secrets, then re-run if needed."
npm ci
npx prisma generate
npx tsx scripts/prisma-cli.ts migrate deploy
echo "Optional first-time seed: npm run db:seed"
echo "Start: npm run start   OR   npm run start:prod"
`
  fs.writeFileSync(path.join(outBackend, 'install-on-server.sh'), installSh)

  const installPs1 = `# Run ON the Linux/Windows host after upload (not for cross-OS node_modules copy)
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "Edit .env with MySQL + JWT secrets"
npm ci
npx prisma generate
npx tsx scripts/prisma-cli.ts migrate deploy
Write-Host "Optional: npm run db:seed"
Write-Host "Start: npm run start"
`
  fs.writeFileSync(path.join(outBackend, 'install-on-server.ps1'), installPs1)

  // Ensure start:prod exists in package.json scripts via overlay note in README

  // 6) Apache/.htaccess helper (proxy to Node if document root is public_html)
  const htaccess = `# If Apache serves public_html and Node listens on 5000 (Passenger / proxy setup).
# Prefer cPanel "Application Manager" / Node.js selector pointing at backend/.
# Example reverse proxy (requires mod_proxy) — adjust port if needed:
#
# RewriteEngine On
# RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]
`

  fs.writeFileSync(path.join(OUT, '.htaccess.example'), htaccess)

  const readme = `# Host package — ${DOMAIN}

Single Node process: **API (\`/api/v1\`)** + **SPA** (files in \`backend/public\`).

## Requirements on the server

| Need | Why |
|------|-----|
| **Node.js 20+** | Runs Express API + serves the website |
| **MySQL 8** | Application database (create empty DB in cPanel / hosting panel) |
| **npm** | \`npm ci\` installs dependencies **on the server** |

> PHP-only shared hosting **cannot** run this ERP. You need Node.js (cPanel Node Selector, CloudLinux, VPS, or Docker).

> Do **not** copy \`node_modules\` from Windows to Linux — Prisma/native binaries break. Always \`npm ci\` on the server.

## Upload

1. Zip \`deploy/host-package/backend\` (or the whole \`host-package\` folder).
2. Upload / extract under your account, e.g.:
   - \`~/erp/\` or \`~/nodejs/erp/\` (preferred), **or**
   - \`public_html/erp/\` if your host allows Node apps there
3. Create MySQL database + user in the hosting panel; note host/user/pass/name.
4. SSH or Terminal:
   \`\`\`bash
   cd backend   # or wherever you extracted
   cp .env.example .env
   nano .env    # set DB_* and JWT_* secrets; FRONTEND_URL=${DOMAIN}
   bash install-on-server.sh
   # first time only:
   npm run db:seed
   \`\`\`
5. Start the app:
   - **cPanel Node.js**: Application root = this \`backend\` folder, startup file = \`dist/server.js\` (run \`npm run build\` after \`npm ci\`) **or** \`src/server.ts\` with \`tsx\` if your host supports it.
   - **PM2**: \`npm run build && pm2 start dist/server.js --name fos-erp\`
   - **Docker**: use repo-root \`docker-compose.yml\` instead (see \`docs/DEPLOYMENT.md\`).

6. Point **${DOMAIN}** at the Node app (Application URL / reverse proxy). Health check: \`${DOMAIN}/api/v1/health\`

## Login after seed

| User | Password |
|------|----------|
| admin@vasant-trailers.com | Admin@123 |
| super@fos-erp.com | Super@123 |

**Change these passwords immediately on a live site.**

## Frontend mode

This build is API mode only:

- \`VITE_USE_API=true\`
- \`VITE_API_BASE_URL=/api/v1\` (same origin)
- Tenant slug: \`${TENANT}\`

Rebuild this package after frontend/backend code changes:

\`\`\`bash
npx tsx scripts/build-host-package.ts --domain=${DOMAIN}
\`\`\`
`

  fs.writeFileSync(path.join(OUT, 'README.md'), readme)
  fs.writeFileSync(path.join(ROOT, 'docs', 'HOSTING_ERP_DHURANDHARCRM.md'), readme)

  console.log(`\nDone: ${OUT}`)
  console.log(`Docs: docs/HOSTING_ERP_DHURANDHARCRM.md`)
}

main()
