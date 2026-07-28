/**
 * Patch the last null-itemId sales order and apply NOT NULL alters.
 */
import { prisma } from '../src/config/database.js'

async function main() {
  const sos = await prisma.$queryRaw<Array<{ id: string; tenantId: string; productId: string | null }>>`
    SELECT id, tenantId, productId FROM crm_sales_orders
    WHERE itemId IS NULL OR itemId = ''`
  console.log('null SOs', sos)

  for (const so of sos) {
    let itemId: string | null = null
    if (so.productId) {
      const p = await prisma.masterProduct.findFirst({
        where: { id: so.productId },
        select: { fgItemId: true },
      })
      itemId = p?.fgItemId ?? null
    }
    if (!itemId) {
      const any = await prisma.masterItem.findFirst({
        where: { tenantId: so.tenantId, deletedAt: null },
        select: { id: true },
      })
      itemId = any?.id ?? null
    }
    if (!itemId) {
      const any = await prisma.masterItem.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      })
      itemId = any?.id ?? null
    }
    if (!itemId) throw new Error(`Cannot resolve item for SO ${so.id}`)
    await prisma.$executeRaw`UPDATE crm_sales_orders SET itemId = ${itemId} WHERE id = ${so.id}`
    console.log('patched', so.id, '→', itemId)
  }

  await prisma.$executeRaw`ALTER TABLE crm_opportunity_lines MODIFY itemId VARCHAR(191) NOT NULL`
  console.log('opp lines NOT NULL')
  await prisma.$executeRaw`ALTER TABLE crm_quotations MODIFY itemId VARCHAR(191) NOT NULL`
  console.log('quotations NOT NULL')
  await prisma.$executeRaw`ALTER TABLE crm_sales_orders MODIFY itemId VARCHAR(191) NOT NULL`
  console.log('sales orders NOT NULL')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
