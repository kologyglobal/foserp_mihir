import { prisma } from '../src/config/database.js'

async function main() {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      migration_name: string
      finished: number
      rolled: number
      logs: string | null
    }>
  >(
    `SELECT migration_name,
            finished_at IS NOT NULL AS finished,
            rolled_back_at IS NOT NULL AS rolled,
            LEFT(COALESCE(logs,''), 400) AS logs
     FROM _prisma_migrations
     WHERE migration_name LIKE '20260722%'
     ORDER BY migration_name`,
  )
  console.log(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2))

  const cols = await prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (
         (TABLE_NAME = 'inventory_stock_balances' AND COLUMN_NAME IN ('avgRate','stockValue'))
         OR (TABLE_NAME = 'manufacturing_costing_policies' AND COLUMN_NAME = 'inventoryValuationMethod')
       )
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  )
  console.log('columns:', JSON.stringify(cols))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
