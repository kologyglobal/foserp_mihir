/**
 * Live smoke: controlled adjustment lifecycle used by the desktop register.
 * create → submit → approve → post → reverse. Ends net-zero on stock.
 */
import { prisma } from '../src/config/prisma.js'
import {
  approveAdjustment,
  createAdjustment,
  postAdjustment,
  reverseAdjustment,
  submitAdjustment,
} from '../src/modules/inventory/adjustments/adjustment.service.js'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!tenant) throw new Error('Tenant vasant-trailers not found')
  const actor = await prisma.user.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } })
  if (!actor) throw new Error('No user found for tenant')

  const balance = await prisma.inventoryStockBalance.findFirst({
    where: { tenantId: tenant.id, onHandQty: { gt: 5 } },
    orderBy: { updatedAt: 'desc' },
    include: { item: { select: { code: true } }, warehouse: { select: { code: true } } },
  })
  if (!balance) throw new Error('No stock balance with onHand > 5 found')
  const startQty = Number(balance.onHandQty)
  console.log(`Using ${balance.item.code} @ ${balance.warehouse.code} — onHand ${startQty}`)

  const doc = await createAdjustment(tenant.id, actor.id, {
    warehouseId: balance.warehouseId,
    reason: 'Desktop register smoke test',
    lines: [{ itemId: balance.itemId, quantity: -3 }],
  })
  console.log(`1. created ${doc.adjustmentNumber} status=${doc.status}`)

  const submitted = await submitAdjustment(tenant.id, doc.id, actor.id)
  console.log(`2. submitted status=${submitted.status}`)
  const approved = await approveAdjustment(tenant.id, doc.id, actor.id)
  console.log(`3. approved status=${approved.status}`)

  const posted = await postAdjustment(tenant.id, doc.id, actor.id, {
    idempotencyKey: `smoke-adj-${doc.id}`,
    remarks: 'smoke post',
  })
  const afterPost = await prisma.inventoryStockBalance.findFirstOrThrow({ where: { id: balance.id } })
  console.log(`4. posted status=${posted.status} onHand=${afterPost.onHandQty}`)
  if (Number(afterPost.onHandQty) !== startQty - 3) throw new Error('Post did not apply adjustment')

  const reversed = await reverseAdjustment(tenant.id, doc.id, actor.id, {
    idempotencyKey: `smoke-adj-rev-${doc.id}`,
    remarks: 'smoke reverse — restore stock',
  })
  const afterReverse = await prisma.inventoryStockBalance.findFirstOrThrow({ where: { id: balance.id } })
  console.log(`5. reversed status=${reversed.status} onHand=${afterReverse.onHandQty}`)
  if (Number(afterReverse.onHandQty) !== startQty) throw new Error('Reverse did not restore stock')

  console.log('PASS — full adjustment lifecycle verified, stock net-zero')
}

main()
  .catch((error) => {
    console.error('FAIL:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
