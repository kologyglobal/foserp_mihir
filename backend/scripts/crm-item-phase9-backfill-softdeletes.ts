/**
 * Backfill itemId on soft-deleted CRM headers from productId→fgItemId (Phase 9 NOT NULL prep).
 */
import { prisma } from '../src/config/prisma.js'

async function main() {
  const sos = await prisma.crmSalesOrder.findMany({
    where: { deletedAt: { not: null }, OR: [{ itemId: null }, { itemId: '' }] },
    select: { id: true, productId: true, tenantId: true },
  })
  console.log(`Soft-deleted SOs missing itemId: ${sos.length}`)
  for (const so of sos) {
    let itemId: string | null = null
    if (so.productId) {
      const product = await prisma.masterProduct.findFirst({
        where: { id: so.productId },
        select: { fgItemId: true },
      })
      itemId = product?.fgItemId ?? null
    }
    if (!itemId) {
      // Last resort: any active item in tenant so NOT NULL can apply
      const anyItem = await prisma.masterItem.findFirst({
        where: { tenantId: so.tenantId, deletedAt: null },
        select: { id: true },
      })
      itemId = anyItem?.id ?? null
    }
    if (!itemId) {
      console.log(`  skip ${so.id} — no item available`)
      continue
    }
    await prisma.crmSalesOrder.update({ where: { id: so.id }, data: { itemId } })
    console.log(`  patched ${so.id} → ${itemId}`)
  }

  const quotes = await prisma.crmQuotation.findMany({
    where: { deletedAt: { not: null }, OR: [{ itemId: null }, { itemId: '' }] },
    select: { id: true, productId: true, tenantId: true },
  })
  console.log(`Soft-deleted quotes missing itemId: ${quotes.length}`)
  for (const q of quotes) {
    let itemId: string | null = null
    if (q.productId) {
      const product = await prisma.masterProduct.findFirst({
        where: { id: q.productId },
        select: { fgItemId: true },
      })
      itemId = product?.fgItemId ?? null
    }
    if (!itemId) {
      const anyItem = await prisma.masterItem.findFirst({
        where: { tenantId: q.tenantId, deletedAt: null },
        select: { id: true },
      })
      itemId = anyItem?.id ?? null
    }
    if (!itemId) continue
    await prisma.crmQuotation.update({ where: { id: q.id }, data: { itemId } })
    console.log(`  patched quote ${q.id} → ${itemId}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
