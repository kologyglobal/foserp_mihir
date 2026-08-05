/**
 * Repair: ensure master_gst_rates.utgst + cess exist (Prisma MasterGstRate).
 * Idempotent — safe if columns already present.
 *
 * Migration: 20260805310000_so_place_of_supply_tax_header
 *
 *   npx tsx scripts/repair-master-gst-rates-utgst.ts
 */
import { prisma } from '../src/config/prisma.js'

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  )) as Array<{ c: bigint | number }>
  return Number(rows[0]?.c ?? 0) > 0
}

async function ensureColumn(sql: string, table: string, column: string): Promise<'added' | 'exists'> {
  if (await columnExists(table, column)) return 'exists'
  await prisma.$executeRawUnsafe(sql)
  return 'added'
}

async function main() {
  const results = {
    utgst: await ensureColumn(
      'ALTER TABLE `master_gst_rates` ADD COLUMN `utgst` DECIMAL(5, 2) NOT NULL DEFAULT 0',
      'master_gst_rates',
      'utgst',
    ),
    cess: await ensureColumn(
      'ALTER TABLE `master_gst_rates` ADD COLUMN `cess` DECIMAL(5, 2) NOT NULL DEFAULT 0',
      'master_gst_rates',
      'cess',
    ),
  }

  // Optional: SO tax header columns from same migration (skip-fail if table missing)
  const soTable = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'crm_sales_orders'`,
  )) as Array<{ c: bigint | number }>
  const soResults: Record<string, string> = {}
  if (Number(soTable[0]?.c ?? 0) > 0) {
    const soCols: Array<[string, string]> = [
      ['placeOfSupply', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupply` VARCHAR(200) NULL'],
      [
        'placeOfSupplyStateCode',
        'ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyStateCode` VARCHAR(8) NULL',
      ],
      [
        'placeOfSupplySource',
        'ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplySource` VARCHAR(32) NULL',
      ],
      [
        'placeOfSupplyOverride',
        'ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyOverride` BOOLEAN NOT NULL DEFAULT false',
      ],
      [
        'placeOfSupplyOverrideReason',
        'ALTER TABLE `crm_sales_orders` ADD COLUMN `placeOfSupplyOverrideReason` VARCHAR(500) NULL',
      ],
      [
        'supplierStateCode',
        'ALTER TABLE `crm_sales_orders` ADD COLUMN `supplierStateCode` VARCHAR(8) NULL',
      ],
      ['supplyType', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `supplyType` VARCHAR(32) NULL'],
      ['gstScheme', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `gstScheme` VARCHAR(32) NULL'],
      ['cgstAmount', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `cgstAmount` DECIMAL(18, 2) NULL'],
      ['sgstAmount', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `sgstAmount` DECIMAL(18, 2) NULL'],
      ['utgstAmount', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `utgstAmount` DECIMAL(18, 2) NULL'],
      ['igstAmount', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `igstAmount` DECIMAL(18, 2) NULL'],
      ['cessAmount', 'ALTER TABLE `crm_sales_orders` ADD COLUMN `cessAmount` DECIMAL(18, 2) NULL'],
    ]
    for (const [col, sql] of soCols) {
      soResults[col] = await ensureColumn(sql, 'crm_sales_orders', col)
    }
  }

  // Ensure Prisma migration history records the formal migration if missing
  const mig = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM _prisma_migrations WHERE migration_name = ?`,
    '20260805310000_so_place_of_supply_tax_header',
  )) as Array<{ c: bigint | number }>
  const migrationRecorded = Number(mig[0]?.c ?? 0) > 0

  console.log(
    JSON.stringify(
      {
        database: 'current DATABASE()',
        master_gst_rates: results,
        crm_sales_orders: soResults,
        migrationRecorded,
        next: migrationRecorded
          ? 'Columns repaired/verified. Restart API if needed.'
          : 'Columns OK. Run: npx tsx scripts/prisma-cli.ts migrate deploy (or prisma migrate resolve --applied 20260805310000_so_place_of_supply_tax_header if SQL was applied manually)',
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
