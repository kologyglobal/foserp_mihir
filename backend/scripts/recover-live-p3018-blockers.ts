/**
 * Recover live/stage DB from Prisma P3018 on
 * `20260727180000_crm_product_to_item_phase9_not_null`, then run migrate deploy.
 *
 * Live often already dropped productId while phase 9 still joins on it.
 *
 * Usage (from your PC with live DB creds — not Hostinger SSH):
 *   cd backend
 *   set DB_HOST=127.0.0.1
 *   set DB_NAME=u233611619_foserp
 *   set DB_USER=u233611619_erpuser_jul
 *   set DB_PASS=...
 *   npm run db:recover-live-p3018
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import mariadb from 'mariadb'

const ROOT = path.resolve(import.meta.dirname, '..')
const MIGRATION = '20260727180000_crm_product_to_item_phase9_not_null'

function checksum(migrationName: string): string {
  const sql = fs.readFileSync(
    path.join(ROOT, 'prisma', 'migrations', migrationName, 'migration.sql'),
    'utf8',
  )
  return createHash('sha256').update(sql).digest('hex')
}

async function hasColumn(
  c: mariadb.Connection,
  db: string,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await c.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  )
  return Number(rows[0].c) > 0
}

async function isNullable(
  c: mariadb.Connection,
  db: string,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await c.query(
    `SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  )
  return rows.length > 0 && rows[0].n === 'YES'
}

async function main() {
  const db = process.env.DB_NAME ?? 'fos_erp'
  const c = await mariadb.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: db,
    multipleStatements: true,
  })

  console.log(`Recover P3018 on ${process.env.DB_USER}@${process.env.DB_HOST}/${db}`)

  if (!(await hasColumn(c, db, 'crm_quotations', 'itemId'))) {
    console.log('Adding crm_quotations.itemId…')
    await c.query('ALTER TABLE `crm_quotations` ADD COLUMN `itemId` VARCHAR(191) NULL')
  }
  if (!(await hasColumn(c, db, 'crm_sales_orders', 'itemId'))) {
    console.log('Adding crm_sales_orders.itemId…')
    await c.query('ALTER TABLE `crm_sales_orders` ADD COLUMN `itemId` VARCHAR(191) NULL')
  }

  if (await hasColumn(c, db, 'crm_quotations', 'productId')) {
    console.log('Backfill crm_quotations from productId…')
    await c.query(`
      UPDATE crm_quotations q
      INNER JOIN master_products p ON p.id = q.productId
      SET q.itemId = p.fgItemId
      WHERE (q.itemId IS NULL OR q.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  } else {
    console.log('Skip crm_quotations productId backfill (column absent)')
  }

  if (await hasColumn(c, db, 'crm_sales_orders', 'productId')) {
    console.log('Backfill crm_sales_orders from productId…')
    await c.query(`
      UPDATE crm_sales_orders so
      INNER JOIN master_products p ON p.id = so.productId
      SET so.itemId = p.fgItemId
      WHERE (so.itemId IS NULL OR so.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  } else {
    console.log('Skip crm_sales_orders productId backfill (column absent)')
  }

  if (await hasColumn(c, db, 'crm_opportunity_lines', 'productId')) {
    console.log('Backfill crm_opportunity_lines from productId…')
    await c.query(`
      UPDATE crm_opportunity_lines ol
      INNER JOIN master_products p ON p.id = ol.productId
      SET ol.itemId = p.fgItemId
      WHERE (ol.itemId IS NULL OR ol.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  } else {
    console.log('Skip crm_opportunity_lines productId backfill (column absent)')
  }

  console.log('Tenant fallback backfill…')
  await c.query(`
    UPDATE crm_sales_orders so
    INNER JOIN (
      SELECT mi.tenantId, MIN(mi.id) AS itemId
      FROM master_items mi
      WHERE mi.deletedAt IS NULL
      GROUP BY mi.tenantId
    ) pick ON pick.tenantId = so.tenantId
    SET so.itemId = pick.itemId
    WHERE (so.itemId IS NULL OR so.itemId = '')
  `)
  await c.query(`
    UPDATE crm_quotations q
    INNER JOIN (
      SELECT mi.tenantId, MIN(mi.id) AS itemId
      FROM master_items mi
      WHERE mi.deletedAt IS NULL
      GROUP BY mi.tenantId
    ) pick ON pick.tenantId = q.tenantId
    SET q.itemId = pick.itemId
    WHERE (q.itemId IS NULL OR q.itemId = '')
  `)
  await c.query(`
    UPDATE crm_opportunity_lines ol
    INNER JOIN (
      SELECT mi.tenantId, MIN(mi.id) AS itemId
      FROM master_items mi
      WHERE mi.deletedAt IS NULL
      GROUP BY mi.tenantId
    ) pick ON pick.tenantId = ol.tenantId
    SET ol.itemId = pick.itemId
    WHERE (ol.itemId IS NULL OR ol.itemId = '')
  `)

  console.log('Cleanup rows without itemId…')
  await c.query(`
    UPDATE crm_sales_orders SET deletedAt = UTC_TIMESTAMP(3)
    WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL
  `)
  await c.query(`
    UPDATE crm_quotations SET deletedAt = UTC_TIMESTAMP(3), status = 'cancelled'
    WHERE (itemId IS NULL OR itemId = '') AND deletedAt IS NULL
  `)
  await c.query(`DELETE FROM crm_sales_orders WHERE itemId IS NULL OR itemId = ''`)
  await c.query(`DELETE FROM crm_quotations WHERE itemId IS NULL OR itemId = ''`)
  await c.query(`DELETE FROM crm_opportunity_lines WHERE itemId IS NULL OR itemId = ''`)

  for (const table of ['crm_opportunity_lines', 'crm_quotations', 'crm_sales_orders'] as const) {
    if (await isNullable(c, db, table, 'itemId')) {
      console.log(`ALTER ${table}.itemId NOT NULL…`)
      await c.query(`ALTER TABLE \`${table}\` MODIFY \`itemId\` VARCHAR(191) NOT NULL`)
    }
  }

  const cs = checksum(MIGRATION)
  await c.query(
    `UPDATE _prisma_migrations
     SET finished_at = COALESCE(finished_at, UTC_TIMESTAMP(3)),
         applied_steps_count = GREATEST(applied_steps_count, 1),
         checksum = ?,
         logs = NULL,
         rolled_back_at = NULL
     WHERE migration_name = ?`,
    [cs, MIGRATION],
  )
  await c.query(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     SELECT UUID(), ?, UTC_TIMESTAMP(3), ?, NULL, NULL, UTC_TIMESTAMP(3), 1
     FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = ?)`,
    [cs, MIGRATION, MIGRATION],
  )

  await c.end()
  console.log(`Marked ${MIGRATION} as applied`)

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
