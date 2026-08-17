import { prisma } from '../src/config/prisma.js'

/**
 * Completes the partially-applied `20260730200000_maintenance_v11_machine_health` migration.
 * On the live DB, `_prisma_migrations` marks this migration as finished, but only the
 * `purchase_requisitions` columns/index actually landed — `maintenance_tickets.repairEndedAt`,
 * `rootCause`, `repairAction`, and the `SAFETY` enum value never got applied, causing:
 *   P2022 maintenance_tickets.repairEndedAt
 * Idempotent via information_schema checks — safe to re-run on any environment.
 */
async function main() {
  async function ensureColumn(table: string, column: string, addSql: string) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      table,
      column,
    )) as unknown[]
    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(addSql)
      console.log('added column', table, column)
    } else {
      console.log('column exists', table, column)
    }
  }

  await ensureColumn(
    'maintenance_tickets',
    'repairEndedAt',
    'ALTER TABLE `maintenance_tickets` ADD COLUMN `repairEndedAt` DATETIME(3) NULL',
  )
  await ensureColumn(
    'maintenance_tickets',
    'rootCause',
    'ALTER TABLE `maintenance_tickets` ADD COLUMN `rootCause` TEXT NULL',
  )
  await ensureColumn(
    'maintenance_tickets',
    'repairAction',
    'ALTER TABLE `maintenance_tickets` ADD COLUMN `repairAction` TEXT NULL',
  )

  // MODIFY COLUMN is idempotent by nature (safe to re-run whether or not SAFETY is already present).
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`maintenance_tickets\`
      MODIFY COLUMN \`failureCategory\` ENUM(
        'MECHANICAL',
        'ELECTRICAL',
        'HYDRAULIC',
        'PNEUMATIC',
        'CONTROL',
        'SAFETY',
        'OTHER'
      ) NULL
  `)
  console.log('failureCategory enum updated (SAFETY ensured)')

  console.log('recovery complete')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
