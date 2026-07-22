import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { collectQualityBlockers, type QualityBlocker } from '../../quality/shared/blockers.service.js'
import { addDec, isPositive, subDec, toDecimal } from '../shared/quantity.service.js'
import { dec } from '../shared/manufacturing.mappers.js'

const COUNTED_RECEIPT_STATUSES = ['POSTED', 'PARTIALLY_REVERSED'] as const

/**
 * Eligible FG qty = completedGoodQuantity − sum(POSTED/PARTIALLY_REVERSED accepted qty)
 * excluding FULLY_REVERSED. Quality blockers zero unrestricted eligibility.
 * Do not use planned quantity alone.
 */
export async function getFgEligibility(tenantId: string, workOrderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      productItemId: true,
      uomId: true,
      completedGoodQuantity: true,
      plannedQuantity: true,
      plantCode: true,
      manufacturingProfileId: true,
      manufacturingProfile: {
        select: {
          finishedGoodsWarehouseId: true,
          batchTrackingRequired: true,
          serialTrackingRequired: true,
          wipTrackingMethod: true,
        },
      },
      productItem: { select: { id: true, code: true, name: true, isStockable: true } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  const receipts = await prisma.productionFinishedGoodsReceipt.findMany({
    where: {
      tenantId,
      productionOrderId: workOrderId,
      deletedAt: null,
      status: { in: [...COUNTED_RECEIPT_STATUSES] },
    },
    select: { acceptedQuantity: true, receiptQuantity: true, reversedQuantity: true, status: true },
  })

  let alreadyReceived = toDecimal(0)
  for (const r of receipts) {
    const accepted = toDecimal(r.acceptedQuantity ?? r.receiptQuantity)
    const reversed = toDecimal(r.reversedQuantity ?? 0)
    alreadyReceived = addDec(alreadyReceived, clampNonNegative(subDec(accepted, reversed)))
  }

  const completedGood = toDecimal(order.completedGoodQuantity)
  const rawEligible = clampNonNegative(subDec(completedGood, alreadyReceived))

  const qualityBlockers = await collectQualityBlockers(tenantId, workOrderId)
  const qualityHold = qualityBlockers.length > 0
  const eligibleUnrestricted = qualityHold ? toDecimal(0) : rawEligible

  return {
    productionOrderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    itemId: order.productItemId,
    item: order.productItem,
    uomId: order.uomId,
    plantCode: order.plantCode,
    manufacturingProfileId: order.manufacturingProfileId,
    completedGoodQuantity: dec(completedGood)!,
    plannedQuantity: dec(order.plannedQuantity)!,
    alreadyReceivedQuantity: dec(alreadyReceived)!,
    rawEligibleQuantity: dec(rawEligible)!,
    eligibleQuantity: dec(eligibleUnrestricted)!,
    qualityHold,
    qualityBlockers: qualityBlockers as QualityBlocker[],
    isStockable: order.productItem.isStockable,
    batchTrackingRequired: order.manufacturingProfile.batchTrackingRequired,
    serialTrackingRequired: order.manufacturingProfile.serialTrackingRequired,
    profileFinishedGoodsWarehouseId: order.manufacturingProfile.finishedGoodsWarehouseId,
    canReceive: isPositive(eligibleUnrestricted) && order.productItem.isStockable,
  }
}

function clampNonNegative(value: ReturnType<typeof toDecimal>) {
  return value.lessThan(0) ? toDecimal(0) : value
}

export async function sumPostedFgReceived(tenantId: string, workOrderId: string) {
  const receipts = await prisma.productionFinishedGoodsReceipt.findMany({
    where: {
      tenantId,
      productionOrderId: workOrderId,
      deletedAt: null,
      status: { in: [...COUNTED_RECEIPT_STATUSES] },
    },
    select: { acceptedQuantity: true, receiptQuantity: true, reversedQuantity: true },
  })
  let total = toDecimal(0)
  for (const r of receipts) {
    const accepted = toDecimal(r.acceptedQuantity ?? r.receiptQuantity)
    const reversed = toDecimal(r.reversedQuantity ?? 0)
    total = addDec(total, clampNonNegative(subDec(accepted, reversed)))
  }
  return total
}
