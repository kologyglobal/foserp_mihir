import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { postFgReceipt } from '../../inventory/movements/movement.service.js'
import { tryRecordManufacturingAccountingEvent } from '../accounting/manufacturing-accounting-event.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { isPositive, toDecimal } from '../shared/quantity.service.js'
import { dec, isoDate } from '../shared/manufacturing.mappers.js'
import { resolveWarehouseMapping } from '../warehouse-mappings/warehouse-mapping.service.js'
import { getFgEligibility } from './fg-eligibility.service.js'
import { FgReceiptValidationError } from './fg-receipt.errors.js'
import type { PostFgReceiptInput, PreviewFgReceiptInput } from './fg-receipt.schemas.js'
import { resolveCostingPolicy } from '../costing/costing-policy.service.js'

function userOf(req: Request) {
  return req.context?.userId ?? ''
}

const receiptInclude = {
  item: { select: { id: true, code: true, name: true } },
  uom: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  productionOrder: { select: { id: true, orderNumber: true } },
} as const

type ReceiptRow = Prisma.ProductionFinishedGoodsReceiptGetPayload<{ include: typeof receiptInclude }>

function mapReceipt(row: ReceiptRow) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    productionOrderId: row.productionOrderId,
    orderNumber: row.productionOrder.orderNumber,
    itemId: row.itemId,
    item: row.item,
    uomId: row.uomId,
    uom: row.uom,
    receiptQuantity: dec(row.receiptQuantity)!,
    acceptedQuantity: dec(row.acceptedQuantity)!,
    warehouseId: row.warehouseId,
    warehouse: row.warehouse,
    qualityInspectionId: row.qualityInspectionId,
    qualityStatus: row.qualityStatus,
    batchOrLotNumber: row.batchOrLotNumber,
    inventoryLotId: row.inventoryLotId,
    serialNumbers: Array.isArray(row.serialNumbersJson) ? (row.serialNumbersJson as string[]) : null,
    inventoryMovementId: row.inventoryMovementId,
    status: row.status,
    receiptDate: isoDate(row.receiptDate),
    remarks: row.remarks,
    idempotencyKey: row.idempotencyKey,
    reversalStatus: row.reversalStatus,
    latestCorrectionId: row.latestCorrectionId,
    postedBy: row.postedBy,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveFgWarehouse(
  tenantId: string,
  plantCode: string | null,
  profileId: string,
  profileFgWarehouseId: string | null,
  overrideWarehouseId?: string,
) {
  if (overrideWarehouseId) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { id: overrideWarehouseId, tenantId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!wh) throw new NotFoundError('Warehouse not found')
    if (wh.status !== 'ACTIVE') throw new FgReceiptValidationError('Warehouse is not active')
    return overrideWarehouseId
  }

  const mapping = await resolveWarehouseMapping(tenantId, plantCode ?? undefined, profileId)
  const warehouseId = mapping?.finishedGoodsWarehouseId ?? profileFgWarehouseId
  if (!warehouseId) {
    throw new FgReceiptValidationError(
      'Finished goods warehouse is not configured (warehouse mapping or manufacturing profile)',
    )
  }
  return warehouseId
}

function assertTracking(
  eligibility: Awaited<ReturnType<typeof getFgEligibility>>,
  input: PostFgReceiptInput,
  quantity: ReturnType<typeof toDecimal>,
) {
  if (eligibility.batchTrackingRequired) {
    if (!input.batchOrLotNumber?.trim()) {
      throw new FgReceiptValidationError('batchOrLotNumber is required by manufacturing profile')
    }
  }
  if (eligibility.serialTrackingRequired) {
    const serials = input.serialNumbers ?? []
    const expected = Math.round(quantity.toNumber())
    if (serials.length !== expected) {
      throw new FgReceiptValidationError(
        `serialNumbers length must equal receipt quantity (${expected}); got ${serials.length}`,
      )
    }
  }
}

export async function listFgReceipts(tenantId: string, workOrderId: string) {
  const exists = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!exists) throw new NotFoundError('Work order not found')

  const rows = await prisma.productionFinishedGoodsReceipt.findMany({
    where: { tenantId, productionOrderId: workOrderId, deletedAt: null },
    include: receiptInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapReceipt)
}

export async function getFgReceipt(tenantId: string, receiptId: string) {
  const row = await prisma.productionFinishedGoodsReceipt.findFirst({
    where: { id: receiptId, tenantId, deletedAt: null },
    include: receiptInclude,
  })
  if (!row) throw new NotFoundError('FG receipt not found')
  return mapReceipt(row)
}

export async function previewFgReceipt(
  tenantId: string,
  workOrderId: string,
  input: PreviewFgReceiptInput = {},
) {
  const eligibility = await getFgEligibility(tenantId, workOrderId)
  const qty = input.quantity != null ? toDecimal(input.quantity) : toDecimal(eligibility.eligibleQuantity)
  const warehouseId = await resolveFgWarehouse(
    tenantId,
    eligibility.plantCode,
    eligibility.manufacturingProfileId,
    eligibility.profileFinishedGoodsWarehouseId,
    input.warehouseId,
  ).catch((err: unknown) => {
    if (err instanceof FgReceiptValidationError || err instanceof NotFoundError) return null
    throw err
  })

  const qtyOk = qty.greaterThan(0) && qty.lessThanOrEqualTo(toDecimal(eligibility.eligibleQuantity))
  return {
    ok: eligibility.canReceive && qtyOk && Boolean(warehouseId),
    eligibility,
    requestedQuantity: dec(qty)!,
    warehouseId,
    errors: [
      ...(!eligibility.isStockable ? ['Product item is not stockable'] : []),
      ...(eligibility.qualityHold ? ['Quality blockers prevent unrestricted FG receipt'] : []),
      ...(!isPositive(eligibility.eligibleQuantity) ? ['No eligible FG quantity remaining'] : []),
      ...(!qtyOk && isPositive(eligibility.eligibleQuantity)
        ? [`Requested quantity exceeds eligible (${eligibility.eligibleQuantity})`]
        : []),
      ...(!warehouseId ? ['Finished goods warehouse not resolved'] : []),
    ],
  }
}

/**
 * Shared FG post path used by explicit API and WO complete (auto).
 * Creates ProductionFinishedGoodsReceipt, posts inventory FG_RECEIPT, accounting event, activity.
 */
export async function postFinishedGoodsReceipt(
  req: Request,
  tenantId: string,
  workOrderId: string,
  input: PostFgReceiptInput,
) {
  const userId = userOf(req)

  if (input.idempotencyKey) {
    const existing = await prisma.productionFinishedGoodsReceipt.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
      include: receiptInclude,
    })
    if (existing && existing.productionOrderId === workOrderId) {
      return mapReceipt(existing)
    }
  }

  const eligibility = await getFgEligibility(tenantId, workOrderId)
  if (!eligibility.isStockable) {
    throw new FgReceiptValidationError('Product item is not stockable; cannot post FG receipt')
  }

  const quantity = toDecimal(input.quantity)
  if (!isPositive(eligibility.eligibleQuantity) || quantity.greaterThan(toDecimal(eligibility.eligibleQuantity))) {
    throw new FgReceiptValidationError(
      `Requested quantity ${quantity.toString()} exceeds eligible FG quantity ${eligibility.eligibleQuantity}` +
        (eligibility.qualityHold ? ' (quality hold)' : ''),
    )
  }

  assertTracking(eligibility, input, quantity)

  const warehouseId = await resolveFgWarehouse(
    tenantId,
    eligibility.plantCode,
    eligibility.manufacturingProfileId,
    eligibility.profileFinishedGoodsWarehouseId,
    input.warehouseId,
  )

  const receiptDate = input.receiptDate
    ? new Date(input.receiptDate.length === 10 ? `${input.receiptDate}T00:00:00.000Z` : input.receiptDate)
    : new Date()

  if (input.draftOnly) {
    const draft = await prisma.$transaction(async (tx) => {
      const receiptNumber = await nextCode(tenantId, 'PRODUCTION_FG_RECEIPT', tx)
      return tx.productionFinishedGoodsReceipt.create({
        data: {
          tenantId,
          receiptNumber,
          productionOrderId: workOrderId,
          itemId: eligibility.itemId,
          uomId: eligibility.uomId,
          receiptQuantity: quantity,
          acceptedQuantity: quantity,
          warehouseId,
          qualityInspectionId: input.qualityInspectionId ?? null,
          qualityStatus: input.qualityStatus ?? null,
          batchOrLotNumber: input.batchOrLotNumber ?? null,
          serialNumbersJson: input.serialNumbers ?? undefined,
          status: 'DRAFT',
          receiptDate,
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
        include: receiptInclude,
      })
    })
    return mapReceipt(draft)
  }

  // Inventory post outside nested tx (postFgReceipt manages its own posting); then persist document.
  const receiptNumber = await nextCode(tenantId, 'PRODUCTION_FG_RECEIPT')
  const movement = await postFgReceipt(req, tenantId, {
    itemId: eligibility.itemId,
    warehouseId,
    quantity: quantity.toNumber(),
    workOrderId,
    idempotencyKey: input.idempotencyKey
      ? `fg-doc:${input.idempotencyKey}`
      : `fg-doc:${tenantId}:${receiptNumber}`,
    referenceNo: eligibility.orderNumber,
    batchNumber: input.batchOrLotNumber,
    lotNumber: input.batchOrLotNumber,
    remarks: input.remarks ?? `FG receipt for WO ${eligibility.orderNumber}`,
    movementDate: receiptDate,
  })

  const inventoryLot = input.batchOrLotNumber
    ? await prisma.inventoryLot.findFirst({
        where: {
          tenantId,
          itemId: eligibility.itemId,
          lotNumber: input.batchOrLotNumber,
          deletedAt: null,
        },
        select: { id: true },
      })
    : null
  const posted = await prisma.productionFinishedGoodsReceipt.create({
    data: {
      tenantId,
      receiptNumber,
      productionOrderId: workOrderId,
      itemId: eligibility.itemId,
      uomId: eligibility.uomId,
      receiptQuantity: quantity,
      acceptedQuantity: quantity,
      warehouseId,
      qualityInspectionId: input.qualityInspectionId ?? null,
      qualityStatus: input.qualityStatus ?? null,
      batchOrLotNumber: input.batchOrLotNumber ?? null,
      inventoryLotId: inventoryLot?.id ?? null,
      serialNumbersJson: input.serialNumbers ?? undefined,
      inventoryMovementId: movement.id,
      status: 'POSTED',
      receiptDate,
      remarks: input.remarks ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      postedBy: userId,
      postedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    },
    include: receiptInclude,
  })

  const latestCost = await prisma.workOrderCostSnapshot.findFirst({
    where: { tenantId, productionOrderId: workOrderId },
    orderBy: { snapshotVersion: 'desc' },
  })
  let accountingAmount = Math.abs(Number(movement.value ?? 0))
  let allocationPayload: Prisma.InputJsonValue = {
    allocationBasis: 'INVENTORY_MOVEMENT_VALUE_FALLBACK',
    movementValue: accountingAmount,
  }
  if (latestCost) {
    const costingPolicy = await resolveCostingPolicy(tenantId, eligibility.plantCode)
    const standardCosting = costingPolicy.costingMethod === 'STANDARD_WITH_VARIANCE'
    const completedGoodQuantity = Number(eligibility.completedGoodQuantity ?? 0)
    const capitalisationQuantity = standardCosting
      ? Number(latestCost.plannedQuantity)
      : completedGoodQuantity
    const accumulatedCost = standardCosting
      ? Number(latestCost.totalPlannedCost)
      : Number(latestCost.totalActualCost)
    const alreadyCapitalised = await prisma.productionAccountingEvent.aggregate({
      where: {
        tenantId,
        productionOrderId: workOrderId,
        eventType: 'FINISHED_GOODS_RECEIVED',
        status: { not: 'REVERSED' },
      },
      _sum: { amount: true },
    })
    const remaining = Math.max(0, accumulatedCost - Number(alreadyCapitalised._sum.amount ?? 0))
    const proportional = capitalisationQuantity > 0
      ? accumulatedCost * quantity.toNumber() / capitalisationQuantity
      : 0
    accountingAmount = Math.max(0, Math.min(proportional, remaining))
    allocationPayload = {
      allocationBasis: standardCosting ? 'STANDARD_UNIT_COST' : 'WORK_ORDER_COST_PROPORTIONAL',
      costingMethod: costingPolicy.costingMethod,
      snapshotId: latestCost.id,
      snapshotVersion: latestCost.snapshotVersion,
      accumulatedEligibleActualCost: accumulatedCost,
      completedGoodQuantity,
      capitalisationQuantity,
      receiptQuantity: quantity.toString(),
      cumulativeCapitalisedBefore: Number(alreadyCapitalised._sum.amount ?? 0),
      allocatedAmount: accountingAmount,
      zeroDenominatorGuarded: capitalisationQuantity <= 0,
    }
  }
  await tryRecordManufacturingAccountingEvent(req, tenantId, {
    eventType: 'FINISHED_GOODS_RECEIVED',
    idempotencyKey: `PROD_FG_RCV:${movement.id}:V1`,
    sourceDocumentType: 'INVENTORY_STOCK_MOVEMENT',
    sourceDocumentId: movement.id,
    productionOrderId: workOrderId,
    quantity,
    amount: accountingAmount,
    narration: `FG receipt ${receiptNumber} for WO ${eligibility.orderNumber}`,
    payloadJson: allocationPayload,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'FG_RECEIVED',
    userId,
    message: `FG receipt ${receiptNumber}: ${quantity.toString()} of ${eligibility.item.code} into warehouse`,
    sourceTransactionId: posted.id,
    newValue: {
      receiptId: posted.id,
      receiptNumber,
      quantity: quantity.toString(),
      warehouseId,
      inventoryMovementId: movement.id,
    },
  })

  return mapReceipt(posted)
}

export async function createFgDraft(
  req: Request,
  tenantId: string,
  workOrderId: string,
  input: PostFgReceiptInput,
) {
  return postFinishedGoodsReceipt(req, tenantId, workOrderId, { ...input, draftOnly: true })
}
