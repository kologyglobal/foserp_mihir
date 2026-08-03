/**
 * Recover local fos_erp from P3009 on
 * `20260720120000_add_purchase_requisition_planning_rfq`.
 *
 * Cause: `20260720250000_purchase_phase3b_requisition` already created
 * manufacturing-shaped `purchase_requisitions` (prNumber). The earlier
 * purchase-UI migration then failed with MySQL 1050 (table exists).
 *
 * Steps:
 *  1. Drop empty phase-3B PR tables (+ manufacturing FK)
 *  2. Mark the failed migration rolled back
 *  3. Refresh checksums for applied migrations whose SQL was corrected
 *  4. Caller runs: npx tsx scripts/prisma-cli.ts migrate deploy
 *  5. Re-add production_order_materials → purchase_requisitions FK
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import mariadb from 'mariadb'

const ROOT = path.resolve(import.meta.dirname, '..')
const MIGRATIONS = path.join(ROOT, 'prisma', 'migrations')

function checksum(migrationName: string): string {
  const sql = fs.readFileSync(path.join(MIGRATIONS, migrationName, 'migration.sql'), 'utf8')
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

  const prCount = await c.query('SELECT COUNT(*) AS c FROM purchase_requisitions')
  const prlCount = await c.query('SELECT COUNT(*) AS c FROM purchase_requisition_lines')
  if (Number(prCount[0].c) > 0 || Number(prlCount[0].c) > 0) {
    throw new Error(
      `Refusing to drop non-empty PR tables (pr=${prCount[0].c}, lines=${prlCount[0].c})`,
    )
  }

  console.log('Dropping manufacturing PR FK (if present)...')
  await c.query(`
    SET @fk_exists := (
      SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'production_order_materials'
        AND CONSTRAINT_NAME = 'production_order_materials_purchaseRequisitionId_fkey'
    );
    SET @ddl := IF(
      @fk_exists > 0,
      'ALTER TABLE production_order_materials DROP FOREIGN KEY production_order_materials_purchaseRequisitionId_fkey',
      'SELECT 1'
    );
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  `)

  console.log('Dropping empty phase-3B purchase_requisition tables...')
  await c.query('DROP TABLE IF EXISTS purchase_requisition_lines')
  await c.query('DROP TABLE IF EXISTS purchase_requisitions')

  console.log('Marking failed 20120000 migration as rolled back...')
  await c.query(`
    UPDATE _prisma_migrations
    SET rolled_back_at = UTC_TIMESTAMP(3),
        finished_at = NULL,
        logs = CONCAT(IFNULL(logs, ''), '\\n[recover] rolled back empty phase-3B collision')
    WHERE migration_name = '20260720120000_add_purchase_requisition_planning_rfq'
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
  `)

  for (const name of [
    '20260720250000_purchase_phase3b_requisition',
    '20260720260000_manufacturing_phase3c_pr_link_fk',
  ]) {
    const cs = checksum(name)
    const result = await c.query(
      `UPDATE _prisma_migrations SET checksum = ? WHERE migration_name = ? AND finished_at IS NOT NULL`,
      [cs, name],
    )
    console.log(`Updated checksum for ${name} → ${cs.slice(0, 12)}… (affected=${result.affectedRows})`)
  }

  await c.end()
  console.log('\nNext: npx tsx scripts/prisma-cli.ts migrate deploy')
  console.log('Then: npx tsx scripts/recover-purchase-pr-fk.ts')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
