import { prisma } from '../src/config/prisma.js'

const tables = ['purchase_order_lines', 'goods_receipt_lines', 'purchase_invoice_lines'] as const
const expected = [
  'gstRatePctSnapshot',
  'cgstRateSnapshot',
  'sgstRateSnapshot',
  'igstRateSnapshot',
  'gstSchemeSnapshot',
]

for (const table of tables) {
  const cols = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${table}' AND COLUMN_NAME LIKE '%Snapshot%' ORDER BY COLUMN_NAME`,
  )
  const names = cols.map((c) => c.COLUMN_NAME)
  console.log(`\n${table}:`)
  for (const col of expected) {
    console.log(`  ${col}: ${names.includes(col) ? 'OK' : 'MISSING'}`)
  }
  if (table !== 'purchase_order_lines') {
    for (const col of ['hsnIdSnapshot', 'hsnCodeSnapshot', 'gstGroupIdSnapshot', 'gstGroupCodeSnapshot']) {
      console.log(`  ${col}: ${names.includes(col) ? 'OK' : 'MISSING'}`)
    }
  }
}

await prisma.$disconnect()
