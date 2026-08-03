/**
 * Apply pending Prisma migrations (Hostinger build + startup + CI).
 * Lightweight — does not run prisma generate (build already did that).
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

const target = parseDbTarget(databaseUrl)
const isHostingerBuild = Boolean(
  process.env.HOSTINGER_GIT_COMMIT || process.env.RUN_MIGRATE_ON_BUILD === 'true',
)
const isProduction = process.env.NODE_ENV === 'production'

if (!databaseUrl.includes('@') || !target.database) {
  console.error('[migrate-deploy] DATABASE_URL / DB_* not configured.')
  process.exit(isHostingerBuild || isProduction ? 1 : 0)
}

if (isHostingerBuild && (target.host === 'localhost' || target.database === 'fos_erp')) {
  console.error(
    `[migrate-deploy] Refusing to migrate default local target ${target.user}@${target.host}/${target.database} during Hostinger build.`,
  )
  console.error('[migrate-deploy] Set DB_HOST and DB_NAME in hPanel Environment Variables.')
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

if (result.status !== 0) {
  console.error('[migrate-deploy] Failed — deploy cannot continue with a schema mismatch.')
  process.exit(result.status ?? 1)
}

console.log('[migrate-deploy] Database schema is up to date.')
