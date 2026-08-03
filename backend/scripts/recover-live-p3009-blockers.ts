/**
 * Recover live/stage DB from Prisma P3009 on
 * `20260727160000_admin_module_administrators`, then run migrate deploy.
 *
 * Usage (from your PC with live DB creds — not Hostinger SSH):
 *   cd backend
 *   set DB_HOST=127.0.0.1
 *   set DB_NAME=u233611619_foserp
 *   set DB_USER=u233611619_erpuser_jul
 *   set DB_PASS=...
 *   npx tsx scripts/recover-live-p3009-blockers.ts
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import mariadb from 'mariadb'

const ROOT = path.resolve(import.meta.dirname, '..')
const FAILED = '20260727160000_admin_module_administrators'

function checksum(migrationName: string): string {
  const sql = fs.readFileSync(
    path.join(ROOT, 'prisma', 'migrations', migrationName, 'migration.sql'),
    'utf8',
  )
  return createHash('sha256').update(sql).digest('hex')
}

async function main() {
  const c = await mariadb.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'fos_erp',
    multipleStatements: true,
  })

  const db = process.env.DB_NAME ?? 'fos_erp'
  console.log(`Recover P3009 on ${process.env.DB_USER}@${process.env.DB_HOST}/${db}`)

  const failed = await c.query(
    `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
     WHERE migration_name = ? AND finished_at IS NULL`,
    [FAILED],
  )

  if (failed.length === 0) {
    console.log(`No failed row for ${FAILED} — checking table…`)
  } else {
    console.log(`Found failed migration row: ${FAILED}`)
  }

  const tables = await c.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'module_administrators'`,
    [db],
  )

  if (Number(tables[0].c) === 0) {
    console.log('Creating module_administrators…')
    const sql = fs.readFileSync(
      path.join(ROOT, 'prisma', 'migrations', FAILED, 'migration.sql'),
      'utf8',
    )
    await c.query(sql)
  } else {
    console.log('module_administrators already exists')
  }

  const cs = checksum(FAILED)
  await c.query(
    `UPDATE _prisma_migrations
     SET finished_at = COALESCE(finished_at, UTC_TIMESTAMP(3)),
         applied_steps_count = GREATEST(applied_steps_count, 1),
         checksum = ?,
         logs = NULL,
         rolled_back_at = NULL
     WHERE migration_name = ?`,
    [cs, FAILED],
  )

  const inserted = await c.query(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     SELECT UUID(), ?, UTC_TIMESTAMP(3), ?, NULL, NULL, UTC_TIMESTAMP(3), 1
     FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = ?)`,
    [cs, FAILED, FAILED],
  )
  if (inserted.affectedRows > 0) {
    console.log(`Inserted applied record for ${FAILED}`)
  } else {
    console.log(`Marked ${FAILED} as applied (checksum refreshed)`)
  }

  await c.end()

  console.log('\nRunning migrate deploy…')
  const migrate = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'migrate-deploy.mjs')], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  })
  process.exit(migrate.status ?? 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
