/**
 * Apply pending Prisma migrations (CI + Hostinger startup).
 * Lightweight — does not run prisma generate (build already did that).
 *
 * Env: DATABASE_URL or DB_HOST / DB_USER / DB_PASS / DB_NAME / DB_PORT
 * Opt-out: RUN_MIGRATE_ON_START=false
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

process.env.DATABASE_URL = buildDatabaseUrl()

if (!process.env.DATABASE_URL.includes('@')) {
  console.error('[migrate-deploy] DATABASE_URL / DB_* not configured — skipping migrate.')
  process.exit(process.env.RUN_MIGRATE_ON_START === 'true' ? 1 : 0)
}

console.log('[migrate-deploy] Applying pending Prisma migrations…')

const prismaBin = join(backend, 'node_modules', 'prisma', 'build', 'index.js')
const args = ['migrate', 'deploy']
const cmd = process.execPath
const cmdArgs = [prismaBin, ...args]

const result = spawnSync(cmd, cmdArgs, {
  cwd: backend,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=512',
  },
  stdio: 'inherit',
})

if (result.status !== 0) {
  console.error('[migrate-deploy] Failed — server must not start with a schema mismatch.')
  process.exit(result.status ?? 1)
}

console.log('[migrate-deploy] Database schema is up to date.')
