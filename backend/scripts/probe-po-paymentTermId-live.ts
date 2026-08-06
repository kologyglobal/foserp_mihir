/**
 * Probe live DB vs Prisma client for purchase_orders.paymentTermId P2022.
 * Usage: set DB_HOST/DB_NAME/DB_USER/DB_PASS then:
 *   npx tsx scripts/probe-po-paymentTermId-live.ts
 */
import { createPrismaClient } from '../src/config/prisma.js'

const prisma = createPrismaClient()

async function main() {
  const db = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`
  console.log('Connected to:', db[0]?.db)

  const paymentCols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'purchase_orders'
      AND COLUMN_NAME LIKE '%payment%'
    ORDER BY COLUMN_NAME
  `
  console.log('\npurchase_orders payment-related columns:')
  for (const c of paymentCols) console.log(' -', c.COLUMN_NAME)

  const hasPaymentTermId = paymentCols.some((c) => c.COLUMN_NAME === 'paymentTermId')
  const hasPaymentTerms = paymentCols.some((c) => c.COLUMN_NAME === 'paymentTerms')
  console.log('\nhas paymentTermId:', hasPaymentTermId)
  console.log('has paymentTerms:', hasPaymentTerms)

  // Check generated client field names on PurchaseOrder scalar fields
  const dmmf = (prisma as unknown as { _dmmf?: { datamodel?: { models?: Array<{ name: string; fields: Array<{ name: string }> }> } } })._dmmf
  const poModel = dmmf?.datamodel?.models?.find((m) => m.name === 'PurchaseOrder')
  const poFields = poModel?.fields?.map((f) => f.name).filter((n) => n.toLowerCase().includes('payment')) ?? []
  console.log('\nPrisma client PurchaseOrder payment fields:', poFields.length ? poFields : '(could not read DMMF — run prisma generate)')

  try {
    await prisma.purchaseOrder.findFirst({
      take: 1,
      include: { vendor: { select: { id: true, name: true } }, lines: { take: 1 } },
    })
    console.log('\nPrisma purchaseOrder.findFirst: OK')
  } catch (e) {
    const err = e as { message?: string; meta?: unknown; code?: string }
    console.log('\nPrisma purchaseOrder.findFirst: FAIL')
    console.log('code:', err.code)
    console.log('message:', err.message)
    console.log('meta:', JSON.stringify(err.meta))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
