import { prisma } from '../src/config/database.js'

async function main() {
  const vp = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM vendor_payments LIKE 'reversal%'")
  const idx = await prisma.$queryRawUnsafe(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payable_allocation_reversal_batches'",
  )
  const linesExists = await prisma.$queryRawUnsafe(
    "SHOW TABLES LIKE 'payable_allocation_reversal_lines'",
  )
  const fks = await prisma.$queryRawUnsafe(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payable_allocation_reversal_batches' AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
  )
  console.log('vp', vp)
  console.log('idx', idx)
  console.log('lines', linesExists)
  console.log('fks', fks)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
