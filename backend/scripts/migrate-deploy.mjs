/**
 * Apply pending Prisma migrations (Hostinger build + startup + CI).
 * Invoked from backend `npm run build` and hostinger-start.mjs.
 *
 * Env: DATABASE_URL or DB_HOST / DB_USER / DB_PASS / DB_NAME / DB_PORT
 * Opt-out: RUN_MIGRATE_ON_BUILD=false or RUN_MIGRATE_ON_START=false
 */
import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..')

config({ path: join(backend, '.env') })

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

const databaseUrl = buildDatabaseUrl()
process.env.DATABASE_URL = databaseUrl

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

process.env.HOSTINGER_STARTUP = process.env.HOSTINGER_STARTUP ?? '0'

const skipMigrate =
  (process.env.npm_lifecycle_event === 'build' &&
    (process.env.RUN_MIGRATE_ON_BUILD === 'false' || process.env.RUN_MIGRATE_ON_BUILD === '0')) ||
  (process.env.HOSTINGER_STARTUP === '1' &&
    (process.env.RUN_MIGRATE_ON_START === 'false' || process.env.RUN_MIGRATE_ON_START === '0'))

if (skipMigrate) {
  console.warn('[migrate-deploy] Skipped (RUN_MIGRATE_ON_BUILD or RUN_MIGRATE_ON_START=false)')
  process.exit(0)
}

const target = parseDbTarget(databaseUrl)
const isDeployContext = Boolean(
  process.env.HOSTINGER_GIT_COMMIT ||
    process.env.RUN_MIGRATE_ON_BUILD === 'true' ||
    process.env.npm_lifecycle_event === 'build' ||
    process.env.NODE_ENV === 'production',
)

if (!databaseUrl.includes('@') || !target.database) {
  console.error('[migrate-deploy] DATABASE_URL / DB_* not configured.')
  process.exit(isDeployContext ? 1 : 0)
}

const usingDefaultLocalTarget =
  (target.host === 'localhost' || target.host === '127.0.0.1') &&
  (target.database === 'fos_erp' || !process.env.DB_NAME)

if (isDeployContext && usingDefaultLocalTarget) {
  console.error(
    `[migrate-deploy] Refusing default local DB ${target.user}@${target.host}/${target.database} during deploy/build.`,
  )
  console.error(
    '[migrate-deploy] Set DB_HOST, DB_NAME, DB_USER, DB_PASS in hPanel for Build AND Runtime (not runtime only).',
  )
  process.exit(1)
}

console.log(
  `[migrate-deploy] Target database: ${target.user}@${target.host}:${target.port}/${target.database}`,
)
console.log('[migrate-deploy] Applying pending Prisma migrations…')

const prismaBin = join(backend, 'node_modules', 'prisma', 'build', 'index.js')
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
    '[migrate-deploy] Apply backend/scripts/live-deploy-receiving-tolerance-master.sql in phpMyAdmin, then redeploy.',
  )
  process.exit(1)
}

if (result.status !== 0) {
  console.error('[migrate-deploy] Failed — deploy cannot continue with a schema mismatch.')
  process.exit(result.status ?? 1)
}

console.log('[migrate-deploy] Database schema is up to date.')
