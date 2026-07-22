import { prisma } from '../src/config/database.js'

async function main() {
  for (const t of [
    'inventory_transfers',
    'inventory_transfer_lines',
    'inventory_stock_counts',
    'inventory_stock_count_lines',
    'inventory_adjustments',
    'inventory_adjustment_lines',
  ]) {
    const r = await prisma.$queryRawUnsafe<any[]>(`SHOW TABLES LIKE '${t}'`)
    console.log(t, r.length ? 'EXISTS' : 'MISSING')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
