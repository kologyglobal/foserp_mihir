/**
 * Assemble deploy/FINAL-UPLOAD — complete folder for cPanel File Manager upload.
 * No SSH / no Terminal: use cPanel File Manager + Node.js App UI only.
 *
 * - Prefer Docker (Linux node_modules baked in): needs Docker Desktop running
 * - Fallback (no Docker): upload source + prebuilt dist/public; click "Run NPM Install" in cPanel
 *
 * Usage: npm run build:final-upload
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const FRONTEND = path.join(ROOT, 'frontend')
const BACKEND = path.join(ROOT, 'backend')
const OUT = path.join(ROOT, 'deploy', 'FINAL-UPLOAD')
const IMAGE = 'fos-erp-final-upload'
const CONTAINER = 'fos-erp-final-upload-ctr'

function run(cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv): boolean {
  console.log(`> ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  })
  return (r.status ?? 1) === 0
}

function mustRun(cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
  if (!run(cmd, args, cwd, env)) throw new Error(`Failed: ${cmd} ${args.join(' ')}`)
}

function rmrf(p: string) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyDir(src: string, dest: string, skip = new Set<string>()) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to, skip)
    else fs.copyFileSync(from, to)
  }
}

function writeEnv(outDir: string) {
  const envBody = `# erp.dhurandharcrm.com — FINAL-UPLOAD (no SSH)
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=u233611619_erp
DB_USER=u233611619_erp
DB_PASS=iSmart@8080+

JWT_ACCESS_SECRET=fos-erp-dhurandhar-access-secret-32chars-min!!
JWT_REFRESH_SECRET=fos-erp-dhurandhar-refresh-secret-32chars-min!
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=https://erp.dhurandharcrm.com

RUN_MIGRATE_ON_START=true
SEED_ON_EMPTY=true

CRM_UPLOAD_DIR=./uploads
CRM_MAX_UPLOAD_BYTES=10485760
`
  fs.writeFileSync(path.join(outDir, '.env'), envBody)
}

function writeReadme(mode: 'docker-full' | 'cpanel-npm') {
  const readme = `# FINAL-UPLOAD — https://erp.dhurandharcrm.com

Complete install folder. **No SSH. No Terminal commands.**

Build mode used: **${mode}**

## Upload steps (cPanel only)

1. Zip everything inside \`deploy/FINAL-UPLOAD\` (this folder).
2. **cPanel → File Manager** → upload ZIP → Extract (e.g. into \`erp/\` or your Node app folder).
3. Confirm MySQL DB/user \`u233611619_erp\` already exists (you created it).
4. **cPanel → Setup Node.js App**:
   - **Application root** = folder that contains \`cpanel-start.mjs\` + \`package.json\`
   - **Application URL** = erp.dhurandharcrm.com
   - **Startup file** = \`cpanel-start.mjs\`
   - **Node.js version** = 20 or 22
5. ${
    mode === 'docker-full'
      ? 'If the panel has **Run NPM Install**, you can skip it (node_modules already included). Otherwise click it once.'
      : 'Click **Run NPM Install** once (installs Linux packages on the server — required).'
  }
6. Click **Start** / **Restart** the application.
7. Wait 1–2 minutes on first start (auto migrate + seed).
8. Open https://erp.dhurandharcrm.com  
   Check https://erp.dhurandharcrm.com/api/v1/health

## After first login

**File Manager** → edit \`.env\` → set \`SEED_ON_EMPTY=false\` → Restart app in Node.js UI.

## Login

| Email | Password |
|-------|----------|
| admin@vasant-trailers.com | Admin@123 |
| super@fos-erp.com | Super@123 |

Change passwords after go-live.

## Rebuild on your PC

\`\`\`bash
npm run build:final-upload
\`\`\`

For a fully pre-installed Linux \`node_modules\` folder, start **Docker Desktop** first, then rebuild.
`

  fs.writeFileSync(path.join(OUT, 'README-UPLOAD.txt'), readme)
  fs.writeFileSync(path.join(ROOT, 'docs', 'HOSTING_FINAL_UPLOAD.md'), readme)
}

function buildWithDocker(): boolean {
  const ok = run('docker', ['info'])
  if (!ok) {
    console.warn('Docker not available — using cPanel NPM Install package (no node_modules).')
    return false
  }
  mustRun('docker', ['build', '-f', 'Dockerfile.final-upload', '-t', IMAGE, '.'], BACKEND)
  spawnSync('docker', ['rm', '-f', CONTAINER], { shell: true })
  mustRun('docker', ['create', '--name', CONTAINER, IMAGE], BACKEND)
  rmrf(OUT)
  fs.mkdirSync(OUT, { recursive: true })
  mustRun('docker', ['cp', `${CONTAINER}:/app/.`, OUT])
  spawnSync('docker', ['rm', '-f', CONTAINER], { shell: true })
  return true
}

function buildWithoutDocker() {
  rmrf(OUT)
  fs.mkdirSync(OUT, { recursive: true })

  // Backend source (no Windows node_modules) — cPanel "Run NPM Install" installs Linux deps
  copyDir(
    BACKEND,
    OUT,
    new Set(['node_modules', 'dist', 'coverage', '.env', 'uploads', '.DS_Store']),
  )

  fs.copyFileSync(path.join(BACKEND, 'cpanel-start.mjs'), path.join(OUT, 'cpanel-start.mjs'))
}

function main() {
  console.log('=== Building FINAL-UPLOAD ===')

  mustRun('npx', ['vite', 'build'], FRONTEND, {
    VITE_USE_API: 'true',
    VITE_API_BASE_URL: '/api/v1',
    VITE_TENANT_SLUG: 'vasant-trailers',
  })

  const usedDocker = buildWithDocker()
  if (!usedDocker) buildWithoutDocker()

  rmrf(path.join(OUT, 'public'))
  copyDir(path.join(FRONTEND, 'dist'), path.join(OUT, 'public'))
  writeEnv(OUT)
  fs.mkdirSync(path.join(OUT, 'uploads'), { recursive: true })
  writeReadme(usedDocker ? 'docker-full' : 'cpanel-npm')

  // Ensure package.json has postinstall prisma generate
  const pkgPath = path.join(OUT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
  }
  pkg.scripts = pkg.scripts ?? {}
  pkg.scripts.postinstall = 'prisma generate'
  pkg.scripts['start:cpanel'] = 'node cpanel-start.mjs'
  pkg.dependencies = pkg.dependencies ?? {}
  if (!pkg.dependencies.prisma) pkg.dependencies.prisma = '^6.9.0'
  if (!pkg.dependencies.tsx) pkg.dependencies.tsx = '^4.19.4'
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

  // Always install node_modules INTO FINAL-UPLOAD (Hostinger: upload ready, no server npm)
  console.log('=== Installing node_modules into FINAL-UPLOAD (Hostinger-ready) ===')
  rmrf(path.join(OUT, 'node_modules'))
  mustRun('npm', ['ci', '--omit=dev'], OUT)
  mustRun('npx', ['prisma', 'generate'], OUT)

  writeReadme(usedDocker ? 'docker-full' : 'preinstalled-npm')

  console.log(`\nDone: ${OUT}`)
  console.log('node_modules included — zip and upload to Hostinger')
}

main()
