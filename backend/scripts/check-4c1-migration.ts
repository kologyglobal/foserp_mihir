import { prisma } from '../src/config/database.js'

async function main() {
  const cols = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM vendor_invoices LIKE 'reversal%'")
  const tables = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'payable_allocation_reversal%'")
  const mig = await prisma.$queryRawUnsafe(
    "SELECT migration_name, finished_at, rolled_back_at, logs FROM _prisma_migrations WHERE migration_name LIKE '%4c1%'",
  )
  console.log(JSON.stringify({ cols, tables, mig }, null, 2))
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
