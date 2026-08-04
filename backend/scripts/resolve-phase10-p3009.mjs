/**
 * One-time fix for P3009 on phase10 (no npm script required):
 *
 *   cd backend   # or Hostinger nodejs/
 *   export DB_HOST=127.0.0.1 DB_NAME=... DB_USER=... DB_PASS=...
 *   node scripts/resolve-phase10-p3009.mjs
 *
 * Or paste live-fix-p3018-crm-phase10-drop-product-id.sql in phpMyAdmin, then redeploy.
 */
import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION = '20260727190000_crm_product_to_item_phase10_drop_product_id'
const PHASE10_TABLES = [
  'crm_opportunity_lines',
  'crm_quotations',
  'crm_sales_orders',
  'dispatch_requirements',
]

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

async function hasColumn(c, db, table, column) {
  const rows = await c.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  )
  return Number(rows[0].n) > 0
}

async function hasTable(c, db, table) {
  const rows = await c.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [db, table],
  )
  return Number(rows[0].n) > 0
}

async function main() {
  const databaseUrl = buildDatabaseUrl()
  if (!databaseUrl) {
    console.error('[resolve-phase10] Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASS')
    process.exit(1)
  }
  process.env.DATABASE_URL = databaseUrl

  const db = new URL(databaseUrl).pathname.replace(/^\//, '')
  let password = process.env.DB_PASS ?? ''
  try {
    password = decodeURIComponent(new URL(databaseUrl).password)
  } catch {
    // keep DB_PASS
  }

  const mariadb = (await import('mariadb')).default
  const c = await mariadb.createConnection({
    host: new URL(databaseUrl).hostname,
    port: Number(new URL(databaseUrl).port || 3306),
    user: new URL(databaseUrl).username,
    password,
    database: db,
    multipleStatements: true,
  })

  try {
    console.log(`[resolve-phase10] Fixing schema on ${db}…`)

    if (
      (await hasTable(c, db, 'dispatch_requirements'))
      && (await hasColumn(c, db, 'dispatch_requirements', 'itemId'))
    ) {
      await c.query(`
        UPDATE dispatch_requirements dr
        INNER JOIN crm_sales_orders so ON so.id = dr.salesOrderId
        SET dr.itemId = so.itemId
        WHERE (dr.itemId IS NULL OR dr.itemId = '')
          AND so.itemId IS NOT NULL AND so.itemId <> ''
      `)
    }

    for (const table of PHASE10_TABLES) {
      if (await hasColumn(c, db, table, 'productId')) {
        await c.query(`ALTER TABLE \`${table}\` DROP COLUMN \`productId\``)
        console.log(`[resolve-phase10] Dropped ${table}.productId`)
      }
    }

    const leftover = await c.query(
      `SELECT TABLE_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'productId'
         AND TABLE_NAME IN (?, ?, ?, ?)`,
      [db, ...PHASE10_TABLES],
    )
    if (leftover.length > 0) {
      throw new Error(
        `productId still on: ${leftover.map((r) => r.TABLE_NAME).join(', ')}`,
      )
    }
    console.log('[resolve-phase10] Verified: no productId on phase10 tables')
  } finally {
    await c.end()
  }

  const prismaBin = join(backend, 'node_modules', 'prisma', 'build', 'index.js')
  console.log(`[resolve-phase10] prisma migrate resolve --applied ${MIGRATION}`)
  const resolve = spawnSync(
    process.execPath,
    [prismaBin, 'migrate', 'resolve', '--applied', MIGRATION],
    { cwd: backend, env: process.env, stdio: 'inherit' },
  )
  if (resolve.status !== 0) {
    console.error('[resolve-phase10] migrate resolve failed')
    process.exit(resolve.status ?? 1)
  }

  console.log('[resolve-phase10] Running migrate deploy…')
  const deploy = spawnSync(
    process.execPath,
    [prismaBin, 'migrate', 'deploy'],
    { cwd: backend, env: process.env, stdio: 'inherit' },
  )
  process.exit(deploy.status ?? 0)
}

main().catch((err) => {
  console.error('[resolve-phase10]', err.message)
  process.exit(1)
})
