/**
 * Live smoke: full stock count lifecycle used by the desktop workbench.
 * create → snapshot → enter counts → submit → approve → post → reverse.
 * Uses a single item×warehouse balance; ends net-zero (post then reverse).
 */
import { prisma } from '../src/config/prisma.js'
import {
  approveStockCount,
  createStockCount,
  enterCounts,
  postStockCount,
  reverseStockCount,
  snapshotStockCount,
  submitStockCount,
} from '../src/modules/inventory/stock-counts/stock-count.service.js'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!tenant) throw new Error('Tenant vasant-trailers not found')
  const actor = await prisma.user.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } })
  if (!actor) throw new Error('No user found for tenant')

  const balance = await prisma.inventoryStockBalance.findFirst({
    where: { tenantId: tenant.id, onHandQty: { gt: 5 } },
    orderBy: { updatedAt: 'desc' },
    include: { item: { select: { code: true, batchTracked: true, serialTracked: true } }, warehouse: { select: { code: true } } },
  })
  if (!balance) throw new Error('No stock balance with onHand > 5 found')
  const startQty = Number(balance.onHandQty)
  console.log(`Using ${balance.item.code} @ ${balance.warehouse.code} — onHand ${startQty}`)

  const doc = await createStockCount(tenant.id, actor.id, {
    warehouseId: balance.warehouseId,
    itemIds: [balance.itemId],
    remarks: 'Desktop workbench smoke test',
  })
  console.log(`1. created ${doc.countNumber} status=${doc.status}`)

  const snap = await snapshotStockCount(tenant.id, doc.id, actor.id)
  const line = snap.lines[0]
  console.log(`2. snapshot status=${snap.status} systemQty=${line.systemQty}`)
  if (Number(line.systemQty) !== startQty) throw new Error('Snapshot systemQty mismatch')

  const countedQty = startQty - 2
  const counted = await enterCounts(tenant.id, doc.id, actor.id, {
    lines: [{ lineId: line.id, countedQty, remarks: 'physical short by 2' }],
  })
  console.log(`3. counts entered status=${counted.status} variance=${counted.lines[0].varianceQty}`)
  if (Number(counted.lines[0].varianceQty) !== -2) throw new Error('Variance mismatch')

  const submitted = await submitStockCount(tenant.id, doc.id, actor.id)
  console.log(`4. submitted status=${submitted.status}`)
  const approved = await approveStockCount(tenant.id, doc.id, actor.id)
  console.log(`5. approved status=${approved.status}`)

  const posted = await postStockCount(tenant.id, doc.id, actor.id, {
    idempotencyKey: `smoke-count-${doc.id}`,
    remarks: 'smoke post',
  })
  const afterPost = await prisma.inventoryStockBalance.findFirstOrThrow({ where: { id: balance.id } })
  console.log(`6. posted status=${posted.status} onHand=${afterPost.onHandQty}`)
  if (Number(afterPost.onHandQty) !== countedQty) throw new Error('Post did not apply variance')

  const reversed = await reverseStockCount(tenant.id, doc.id, actor.id, {
    idempotencyKey: `smoke-count-rev-${doc.id}`,
    remarks: 'smoke reverse — restore stock',
  })
  const afterReverse = await prisma.inventoryStockBalance.findFirstOrThrow({ where: { id: balance.id } })
  console.log(`7. reversed status=${reversed.status} onHand=${afterReverse.onHandQty}`)
  if (Number(afterReverse.onHandQty) !== startQty) throw new Error('Reverse did not restore stock')

  const ledger = await prisma.inventoryStockMovement.findMany({
    where: { tenantId: tenant.id, referenceNo: doc.countNumber },
    select: { movementNumber: true, referenceType: true, quantity: true },
  })
  console.log('Ledger rows:', ledger)
  console.log('PASS — full desktop stock count lifecycle verified, stock net-zero')
}

main()
  .catch((error) => {
    console.error('FAIL:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
