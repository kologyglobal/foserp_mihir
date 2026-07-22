import { prisma } from '../../../config/database.js'
import { resolveWarehouseMapping } from '../../manufacturing/warehouse-mappings/warehouse-mapping.service.js'
import { n, roundQty } from '../shared/dispatch-qty.js'

export interface FgAvailability {
  itemId: string
  unrestrictedOnHand: number
  qualityHoldOnHand: number
  reservedQty: number
  availableToDispatch: number
  preferredWarehouseId: string | null
  qualityHoldWarehouseId: string | null
  finishedGoodsWarehouseId: string | null
}

/**
 * Inventory-owned availability for dispatch readiness.
 * Only the UNRESTRICTED bucket is dispatchable. Warehouse roles remain an
 * additional operational exclusion, not the source of stock status.
 */
export async function getFgAvailabilityByItemIds(
  tenantId: string,
  itemIds: string[],
): Promise<Map<string, FgAvailability>> {
  const unique = [...new Set(itemIds.filter(Boolean))]
  const result = new Map<string, FgAvailability>()
  if (!unique.length) return result

  const mapping = await resolveWarehouseMapping(tenantId)
  const fgWh = mapping?.finishedGoodsWarehouseId ?? null
  const holdWh = mapping?.qualityHoldWarehouseId ?? null
  const blockedWh = new Set(
    [mapping?.qualityHoldWarehouseId, mapping?.reworkWarehouseId, mapping?.scrapWarehouseId].filter(
      (id): id is string => Boolean(id),
    ),
  )

  const balances = await prisma.inventoryStockBalance.findMany({
    where: {
      tenantId,
      itemId: { in: unique },
      warehouse: { deletedAt: null, status: 'ACTIVE' },
    },
    select: {
      itemId: true,
      warehouseId: true,
      onHandQty: true,
      reservedQty: true,
      qcHoldQty: true,
      blockedQty: true,
      rejectedQty: true,
    },
  })

  for (const itemId of unique) {
    let unrestrictedOnHand = 0
    let qualityHoldOnHand = 0
    let reservedQty = 0

    for (const row of balances.filter((b) => b.itemId === itemId)) {
      const onHand = n(row.onHandQty)
      const qcHold = n(row.qcHoldQty)
      const unrestricted = Math.max(
        0,
        onHand - qcHold - n(row.blockedQty) - n(row.rejectedQty),
      )
      const reserved = n(row.reservedQty)
      if (holdWh && row.warehouseId === holdWh) {
        qualityHoldOnHand += qcHold || onHand
        continue
      }
      if (blockedWh.has(row.warehouseId)) continue
      qualityHoldOnHand += qcHold
      unrestrictedOnHand += unrestricted
      reservedQty += reserved
    }

    const availableToDispatch = roundQty(Math.max(0, unrestrictedOnHand - reservedQty))
    result.set(itemId, {
      itemId,
      unrestrictedOnHand: roundQty(unrestrictedOnHand),
      qualityHoldOnHand: roundQty(qualityHoldOnHand),
      reservedQty: roundQty(reservedQty),
      availableToDispatch,
      preferredWarehouseId: fgWh,
      qualityHoldWarehouseId: holdWh,
      finishedGoodsWarehouseId: fgWh,
    })
  }

  return result
}
