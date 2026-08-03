/**
 * Production migration step — runs `prisma migrate deploy` only.
 *
 * Invoked from backend `npm run build` (Hostinger) or `npm run db:deploy:hostinger`.
 * Emergency one-time repair: `npm run db:recover-known` — never called from here.
 *
 * Env: DATABASE_URL or DB_HOST + DB_NAME + DB_USER + DB_PASS (+ optional DB_PORT)
 */
import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..')

config({ path: join(backend, '.env') })

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const host = process.env.DB_HOST
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME
  const user = process.env.DB_USER
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')

  if (!host || !name || !user) return null

  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

function parseDbTarget(url) {
  try {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: u.port || '3306',
      database: u.pathname.replace(/^\//, ''),
      user: u.username,
    }
  } catch {
    return { host: '?', port: '?', database: '?', user: '?' }
  }
}

const databaseUrl = buildDatabaseUrl()

if (!databaseUrl) {
  console.error('[migrate-deploy] Live database environment is missing.')
  console.error('[migrate-deploy] Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASS in hPanel (Build + Runtime).')
  process.exit(1)
}

process.env.DATABASE_URL = databaseUrl

const target = parseDbTarget(databaseUrl)
const usingDefaultLocalTarget =
  (target.host === 'localhost' || target.host === '127.0.0.1') &&
  (target.database === 'fos_erp' || !process.env.DB_NAME)

if (usingDefaultLocalTarget && !process.env.ALLOW_LOCAL_MIGRATE) {
  console.error(
    `[migrate-deploy] Refusing default local DB ${target.user}@${target.host}/${target.database}.`,
  )
  console.error('[migrate-deploy] Set real DB_* for deploy, or ALLOW_LOCAL_MIGRATE=1 for local migrate.')
  process.exit(1)
}

console.log(
  `[migrate-deploy] Target database: ${target.user}@${target.host}:${target.port}/${target.database}`,
)

const prismaBin = join(backend, 'node_modules', 'prisma', 'build', 'index.js')

console.log('[migrate-deploy] Applying pending Prisma migrations…')

const result = spawnSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
  cwd: backend,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=768',
  },
  stdio: 'inherit',
})

if (result.error?.message?.includes('Killed') || result.signal === 'SIGKILL') {
  console.error('[migrate-deploy] Process was Killed (likely OOM on shared hosting).')
  console.error(
    '[migrate-deploy] Apply pending SQL manually in phpMyAdmin, then use prisma migrate resolve or redeploy.',
  )
  process.exit(1)
}

if (result.status !== 0) {
  console.error('[migrate-deploy] Migration failed. Deployment stopped.')
  console.error('[migrate-deploy] Inspect: npx prisma migrate status')
  console.error('[migrate-deploy] One-time P3009 fix (SSH): node scripts/resolve-phase10-p3009.mjs')
  console.error('[migrate-deploy] Or phpMyAdmin: scripts/live-fix-p3018-crm-phase10-drop-product-id.sql')
  process.exit(result.status ?? 1)
}

console.log('[migrate-deploy] Database schema is up to date.')
