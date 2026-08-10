/**
 * Seed demo stock reservations so /inventory/store/reservations has visible data.
 * Reserves free stock against real work orders (WO) and a sales order (SO) when
 * available - falls back to generated demand IDs otherwise. Idempotent via
 * idempotencyKey, safe to re-run.
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/config/prisma.js'
import { nextCode } from '../src/services/codeSeries.service.js'
import { applyReservationDeltaInTx, freeQty, getOrCreateBalance } from '../src/modules/inventory/shared/balance.service.js'
import { toDecimal } from '../src/modules/inventory/shared/quantity.helpers.js'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!tenant) throw new Error('Tenant vasant-trailers not found')
  const actor = await prisma.user.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } })
  if (!actor) throw new Error('No user found for tenant')

  // Balances with meaningful free stock, active + stockable items only.
  const balances = await prisma.inventoryStockBalance.findMany({
    where: {
      tenantId: tenant.id,
      onHandQty: { gt: 2 },
      item: { deletedAt: null, isStockable: true, isBlocked: false, status: 'ACTIVE' },
    },
    orderBy: { onHandQty: 'desc' },
    take: 20,
    include: {
      item: { select: { code: true, name: true } },
      warehouse: { select: { code: true } },
    },
  })
  const usable = balances.filter((b) => freeQty(b).greaterThan(1))
  if (usable.length === 0) throw new Error('No balances with free stock found - post some inward stock first')

  const workOrders = await prisma.productionOrder.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { id: true, orderNumber: true },
  })
  const salesOrder = await prisma.crmSalesOrder.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, salesOrderNo: true },
  })

  const plans: Array<{
    demandType: 'WO' | 'SO'
    demandId: string
    referenceNo: string
    remarks: string
  }> = [
    {
      demandType: 'WO',
      demandId: workOrders[0]?.id ?? randomUUID(),
      referenceNo: workOrders[0]?.orderNumber ?? 'WO-DEMO-001',
      remarks: 'Demo: material reserved for work order',
    },
    {
      demandType: 'WO',
      demandId: workOrders[1]?.id ?? randomUUID(),
      referenceNo: workOrders[1]?.orderNumber ?? 'WO-DEMO-002',
      remarks: 'Demo: material reserved for work order',
    },
    {
      demandType: 'SO',
      demandId: salesOrder?.id ?? randomUUID(),
      referenceNo: salesOrder?.salesOrderNo ?? 'SO-DEMO-001',
      remarks: 'Demo: finished stock reserved for sales order',
    },
  ]

  let created = 0
  for (let i = 0; i < plans.length; i += 1) {
    const plan = plans[i]!
    const balance = usable[i % usable.length]!
    const idempotencyKey = `seed-demo-resv-${plan.demandType}-${i}`

    const existing = await prisma.inventoryStockReservation.findFirst({
      where: { tenantId: tenant.id, idempotencyKey },
      select: { reservationNumber: true },
    })
    if (existing) {
      console.log(`- ${existing.reservationNumber} already seeded (${plan.referenceNo}) - skipping`)
      continue
    }

    // Reserve ~25% of free stock, at least 1, capped at 50 so demo data stays sane.
    const free = freeQty(balance)
    const qty = toDecimal(Math.min(Math.max(Math.floor(free.toNumber() * 0.25), 1), 50))

    const row = await prisma.$transaction(async (tx) => {
      const fresh = await getOrCreateBalance(tx, tenant.id, balance.itemId, balance.warehouseId)
      if (qty.greaterThan(freeQty(fresh))) throw new Error('Free stock changed underneath - re-run the script')
      const reservationNumber = await nextCode(tenant.id, 'STOCK_RESERVATION', tx)
      const reservation = await tx.inventoryStockReservation.create({
        data: {
          tenantId: tenant.id,
          reservationNumber,
          itemId: balance.itemId,
          warehouseId: balance.warehouseId,
          quantity: qty,
          demandType: plan.demandType,
          demandId: plan.demandId,
          referenceNo: plan.referenceNo,
          remarks: plan.remarks,
          idempotencyKey,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      })
      await applyReservationDeltaInTx(tx, tenant.id, balance.itemId, balance.warehouseId, qty)
      return reservation
    })
    created += 1
    console.log(
      `+ ${row.reservationNumber}: ${qty} of ${balance.item.code} (${balance.item.name}) @ ${balance.warehouse.code} -> ${plan.demandType} ${plan.referenceNo}`,
    )
  }

  console.log(`Done - ${created} reservation(s) created.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
