/**
 * One-time emergency: recover known failed migrations, then migrate deploy.
 *
 * Prefer prisma migrate resolve when schema already matches migration.sql.
 * This script is for legacy P3009/P3018 blockers only.
 *
 * Usage (PC with live DB creds):
 *   cd backend
 *   set DB_HOST=...
 *   set DB_NAME=...
 *   set DB_USER=...
 *   set DB_PASS=...
 *   npm run db:recover-live-p3018
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { recoverKnownMigrationBlockers } from './migrate-recover-known-blockers.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')

async function main() {
  const host = process.env.DB_HOST ?? 'localhost'
  const port = Number(process.env.DB_PORT ?? 3306)
  const user = process.env.DB_USER ?? 'root'
  const password = process.env.DB_PASS ?? ''
  const database = process.env.DB_NAME ?? 'fos_erp'

  console.warn('[db:recover-live-p3018] EMERGENCY repair — not for routine deploys.')
  console.log(`Target: ${user}@${host}/${database}`)

  await recoverKnownMigrationBlockers({ host, port, user, password, database })

  console.log('\nRunning prisma migrate deploy…')
  const migrate = spawnSync('npm', ['run', 'db:migrate:deploy'], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  })
  process.exit(migrate.status ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
