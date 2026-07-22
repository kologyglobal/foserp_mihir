import { prisma } from '../src/config/database.js'

async function col(table: string, column: string) {
  const r = await prisma.$queryRawUnsafe<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`)
  console.log(`${table}.${column}`, r.length ? 'EXISTS' : 'MISSING')
}

async function main() {
  await col('vendor_quotations', 'discountAmount')
  await col('vendor_quotations', 'otherCharges')
  await col('vendor_quotations', 'landedCost')
  await col('vendor_quotations', 'warranty')
  await col('vendor_comparisons', 'selectionReason')
  await col('vendor_comparisons', 'awardedById')

  const failed = await prisma.$queryRawUnsafe<any[]>(
    `SELECT migration_name, LEFT(COALESCE(logs,''), 400) AS logs
     FROM _prisma_migrations
     WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
  )
  console.log('failed', failed)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
