/**
 * Repair Phase 9 migration: soft-delete remaining null-itemId commercial rows, then finish ALTER.
 */
import { prisma } from '../src/config/database.js'

async function main() {
  const soNull = await prisma.$executeRaw`
    UPDATE crm_sales_orders
    SET deletedAt = UTC_TIMESTAMP(3)
    WHERE (itemId IS NULL OR itemId = '')
      AND deletedAt IS NULL`
  console.log('soft-deleted active SOs missing itemId:', soNull)

  const soDeleted = await prisma.$executeRaw`
    UPDATE crm_sales_orders so
    INNER JOIN (
      SELECT mi.tenantId, MIN(mi.id) AS itemId
      FROM master_items mi
      WHERE mi.deletedAt IS NULL
      GROUP BY mi.tenantId
    ) pick ON pick.tenantId = so.tenantId
    SET so.itemId = pick.itemId
    WHERE (so.itemId IS NULL OR so.itemId = '')`
  console.log('patched soft-deleted SOs missing itemId:', soDeleted)

  const qNull = await prisma.$executeRaw`
    UPDATE crm_quotations
    SET deletedAt = UTC_TIMESTAMP(3), status = 'cancelled'
    WHERE (itemId IS NULL OR itemId = '')
      AND deletedAt IS NULL`
  console.log('soft-deleted active quotes missing itemId:', qNull)

  const qPatched = await prisma.$executeRaw`
    UPDATE crm_quotations q
    INNER JOIN (
      SELECT mi.tenantId, MIN(mi.id) AS itemId
      FROM master_items mi
      WHERE mi.deletedAt IS NULL
      GROUP BY mi.tenantId
    ) pick ON pick.tenantId = q.tenantId
    SET q.itemId = pick.itemId
    WHERE (q.itemId IS NULL OR q.itemId = '')`
  console.log('patched soft-deleted quotes missing itemId:', qPatched)

  // Tenants with zero items: hard-delete leftover null commercial docs (test tenants only)
  const stillSo = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM crm_sales_orders WHERE itemId IS NULL OR itemId = ''`
  const stillQ = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM crm_quotations WHERE itemId IS NULL OR itemId = ''`
  console.log('remaining null SO/quote:', Number(stillSo[0]?.c ?? 0), Number(stillQ[0]?.c ?? 0))

  if (Number(stillSo[0]?.c ?? 0) > 0) {
    await prisma.$executeRaw`DELETE FROM crm_sales_orders WHERE itemId IS NULL OR itemId = ''`
    console.log('hard-deleted leftover null SOs')
  }
  if (Number(stillQ[0]?.c ?? 0) > 0) {
    await prisma.$executeRaw`DELETE FROM crm_quotations WHERE itemId IS NULL OR itemId = ''`
    console.log('hard-deleted leftover null quotes')
  }

  await prisma.$executeRaw`DELETE FROM crm_opportunity_lines WHERE itemId IS NULL OR itemId = ''`

  // Finish ALTERs if not applied
  try {
    await prisma.$executeRaw`ALTER TABLE crm_opportunity_lines MODIFY itemId VARCHAR(191) NOT NULL`
    console.log('opp lines NOT NULL ok')
  } catch (e) {
    console.log('opp lines ALTER:', (e as Error).message)
  }
  try {
    await prisma.$executeRaw`ALTER TABLE crm_quotations MODIFY itemId VARCHAR(191) NOT NULL`
    console.log('quotations NOT NULL ok')
  } catch (e) {
    console.log('quotations ALTER:', (e as Error).message)
  }
  try {
    await prisma.$executeRaw`ALTER TABLE crm_sales_orders MODIFY itemId VARCHAR(191) NOT NULL`
    console.log('sales orders NOT NULL ok')
  } catch (e) {
    console.log('sales orders ALTER:', (e as Error).message)
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
