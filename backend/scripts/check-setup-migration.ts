import { prisma } from '../src/config/database.js'

async function main() {
  const mig = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
  >(
    "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name LIKE '%purchase_setup_full%'",
  )
  console.log('migration rows', mig)

  for (const table of [
    'purchase_approval_tier_roles',
    'purchase_approval_tiers',
    'purchase_inspection_categories',
    'quality_inspection_lines',
    'quality_inspections',
    'purchase_invoice_lines',
    'purchase_invoices',
    'purchase_return_lines',
    'purchase_returns',
  ]) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SHOW TABLES LIKE '${table}'`)
    console.log(table, rows.length ? 'EXISTS' : 'missing')
  }

  const cols = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    "SHOW COLUMNS FROM purchase_settings LIKE 'allowDirectInvoice'",
  )
  console.log('allowDirectInvoice column', cols.length ? 'EXISTS' : 'missing')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
