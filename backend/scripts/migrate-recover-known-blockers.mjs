/**
 * Auto-recover known Prisma P3009/P3018 blockers before migrate deploy.
 * Safe to run every build — no-ops when nothing is failed.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..')

function migrationChecksum(migrationName) {
  const sql = readFileSync(
    join(backend, 'prisma', 'migrations', migrationName, 'migration.sql'),
    'utf8',
  )
  return createHash('sha256').update(sql).digest('hex')
}

async function hasColumn(c, db, table, column) {
  const rows = await c.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  )
  return Number(rows[0].c) > 0
}

async function isNullable(c, db, table, column) {
  const rows = await c.query(
    `SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [db, table, column],
  )
  return rows.length > 0 && rows[0].n === 'YES'
}

async function hasTable(c, db, table) {
  const rows = await c.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [db, table],
  )
  return Number(rows[0].c) > 0
}

async function markMigrationApplied(c, migrationName) {
  const cs = migrationChecksum(migrationName)
  await c.query(
    `UPDATE _prisma_migrations
     SET finished_at = COALESCE(finished_at, UTC_TIMESTAMP(3)),
         applied_steps_count = GREATEST(applied_steps_count, 1),
         checksum = ?,
         logs = NULL,
         rolled_back_at = NULL
     WHERE migration_name = ? AND finished_at IS NULL`,
    [cs, migrationName],
  )
  await c.query(
    `INSERT INTO _prisma_migrations (
       id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
     )
     SELECT UUID(), ?, UTC_TIMESTAMP(3), ?, NULL, NULL, UTC_TIMESTAMP(3), 1
     FROM DUAL
     WHERE NOT EXISTS (
       SELECT 1 FROM _prisma_migrations WHERE migration_name = ?
     )`,
    [cs, migrationName, migrationName],
  )
}

async function recoverAdminModuleAdministrators(c, db) {
  const migration = '20260727160000_admin_module_administrators'
  console.log(`[migrate-recover] Recovering ${migration}…`)

  if (!(await hasTable(c, db, 'module_administrators'))) {
    const sql = readFileSync(
      join(backend, 'prisma', 'migrations', migration, 'migration.sql'),
      'utf8',
    )
    await c.query(sql)
    console.log('[migrate-recover] Created module_administrators')
  }

  await markMigrationApplied(c, migration)
  console.log(`[migrate-recover] Marked ${migration} as applied`)
}

async function recoverCrmPhase9NotNull(c, db) {
  const migration = '20260727180000_crm_product_to_item_phase9_not_null'
  console.log(`[migrate-recover] Recovering ${migration}…`)

  if (!(await hasColumn(c, db, 'crm_quotations', 'itemId'))) {
    await c.query('ALTER TABLE `crm_quotations` ADD COLUMN `itemId` VARCHAR(191) NULL')
  }
  if (!(await hasColumn(c, db, 'crm_sales_orders', 'itemId'))) {
    await c.query('ALTER TABLE `crm_sales_orders` ADD COLUMN `itemId` VARCHAR(191) NULL')
  }

  if (await hasColumn(c, db, 'crm_quotations', 'productId')) {
    await c.query(`
      UPDATE crm_quotations q
      INNER JOIN master_products p ON p.id = q.productId
      SET q.itemId = p.fgItemId
      WHERE (q.itemId IS NULL OR q.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  }

  if (await hasColumn(c, db, 'crm_sales_orders', 'productId')) {
    await c.query(`
      UPDATE crm_sales_orders so
      INNER JOIN master_products p ON p.id = so.productId
      SET so.itemId = p.fgItemId
      WHERE (so.itemId IS NULL OR so.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  }

  if (await hasColumn(c, db, 'crm_opportunity_lines', 'productId')) {
    await c.query(`
      UPDATE crm_opportunity_lines ol
      INNER JOIN master_products p ON p.id = ol.productId
      SET ol.itemId = p.fgItemId
      WHERE (ol.itemId IS NULL OR ol.itemId = '')
        AND p.fgItemId IS NOT NULL AND p.fgItemId <> ''
    `)
  }

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

  for (const table of ['crm_opportunity_lines', 'crm_quotations', 'crm_sales_orders']) {
    if (await isNullable(c, db, table, 'itemId')) {
      await c.query(`ALTER TABLE \`${table}\` MODIFY \`itemId\` VARCHAR(191) NOT NULL`)
    }
  }

  await markMigrationApplied(c, migration)
  console.log(`[migrate-recover] Marked ${migration} as applied`)
}

const RECOVERERS = {
  '20260727160000_admin_module_administrators': recoverAdminModuleAdministrators,
  '20260727180000_crm_product_to_item_phase9_not_null': recoverCrmPhase9NotNull,
}

export async function recoverKnownMigrationBlockers(connectionConfig) {
  let mariadb
  try {
    mariadb = (await import('mariadb')).default
  } catch {
    console.warn('[migrate-recover] mariadb driver unavailable — skipping auto-recovery')
    return
  }

  const db = connectionConfig.database
  let c
  try {
    c = await mariadb.createConnection({
      ...connectionConfig,
      multipleStatements: true,
    })

    const failed = await c.query(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
    )

    if (failed.length === 0) {
      console.log('[migrate-recover] No failed migrations — nothing to recover')
      return
    }

    for (const row of failed) {
      const name = row.migration_name
      const recover = RECOVERERS[name]
      if (!recover) {
        console.warn(`[migrate-recover] Unknown failed migration: ${name} (manual fix required)`)
        continue
      }
      await recover(c, db)
    }
  } catch (err) {
    console.warn('[migrate-recover] Auto-recovery failed (migrate deploy may still fail):', err.message)
  } finally {
    if (c) await c.end()
  }
}
