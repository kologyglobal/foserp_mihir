import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { postStockMovement } from '../shared/stock-posting.service.js'
import { mapStockMovement } from '../shared/inventory.mappers.js'
import type {
  AdjustmentMovementInput,
  FgDispatchIssueInput,
  FgReceiptInput,
  IssueToWorkOrderInput,
  PositiveQtyMovementInput,
  ReturnFromWorkOrderInput,
} from './movement.schemas.js'

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function tracking(input: PositiveQtyMovementInput) {
  return {
    stockStatus: input.stockStatus,
    batchId: input.batchId,
    batchNumber: input.batchNumber,
    lotNumber: input.lotNumber,
    heatNumber: input.heatNumber,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    serialId: input.serialId,
    serialNumber: input.serialNumber,
  }
}

function canOverrideNegativeStock(req: Request): boolean {
  return (
    req.context?.permissions.includes('inventory.issues.override_negative_stock') === true ||
    req.context?.permissions.includes('tenant.manage') === true
  )
}

async function resolveFgReceiptRate(
  tenantId: string,
  itemId: string,
  workOrderId: string | undefined,
  requestedRate: number | undefined,
): Promise<number> {
  if (requestedRate && requestedRate > 0) return requestedRate
  try {
    const [snapshot, item] = await Promise.all([
      workOrderId
        ? prisma.workOrderCostSnapshot.findFirst({
            where: { tenantId, productionOrderId: workOrderId },
            orderBy: { snapshotVersion: 'desc' },
            select: { unitActualCost: true, unitPlannedCost: true },
          })
        : null,
      prisma.masterItem.findFirst({
        where: { id: itemId, tenantId, deletedAt: null },
        select: { standardRate: true },
      }),
    ])
    const snapshotRate = Number(snapshot?.unitActualCost ?? 0) > 0
      ? Number(snapshot!.unitActualCost)
      : Number(snapshot?.unitPlannedCost ?? 0)
    return snapshotRate > 0 ? snapshotRate : Number(item?.standardRate ?? 0)
  } catch {
    return 0
  }
}

export async function postOpening(req: Request, tenantId: string, input: PositiveQtyMovementInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'OPENING',
    referenceType: 'OPN',
    quantity: input.quantity,
    movementDate: input.movementDate,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

export async function postInward(req: Request, tenantId: string, input: PositiveQtyMovementInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'INWARD',
    referenceType: 'INW',
    quantity: input.quantity,
    movementDate: input.movementDate,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

export async function postIssue(req: Request, tenantId: string, input: PositiveQtyMovementInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'ISSUE',
    referenceType: 'ISS',
    quantity: input.quantity,
    movementDate: input.movementDate,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
    allowNegativeStock: canOverrideNegativeStock(req),
  })
  return mapStockMovement(movement)
}

export async function postAdjustment(req: Request, tenantId: string, input: AdjustmentMovementInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'ADJUSTMENT',
    referenceType: 'ADJ',
    quantity: input.quantity,
    movementDate: input.movementDate,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

export async function postIssueToWorkOrder(req: Request, tenantId: string, input: IssueToWorkOrderInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'ISSUE',
    referenceType: 'ISSUE_TO_WO',
    quantity: input.quantity,
    movementDate: input.movementDate,
    workOrderId: input.workOrderId,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
    allowNegativeStock: canOverrideNegativeStock(req),
    consumeWoReservation: input.consumeReservation,
  })
  return mapStockMovement(movement)
}

export async function postReturnFromWorkOrder(req: Request, tenantId: string, input: ReturnFromWorkOrderInput) {
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'INWARD',
    referenceType: 'RETURN_FROM_WO',
    quantity: input.quantity,
    movementDate: input.movementDate,
    workOrderId: input.workOrderId,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

export async function postFgReceipt(req: Request, tenantId: string, input: FgReceiptInput) {
  const rate = await resolveFgReceiptRate(
    tenantId,
    input.itemId,
    input.workOrderId,
    input.rate,
  )
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'INWARD',
    referenceType: 'FG_RECEIPT',
    quantity: input.quantity,
    movementDate: input.movementDate,
    workOrderId: input.workOrderId,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

/** Semi-finished / sub-assembly receipt into WIP (Tank SA family). */
export async function postSaReceipt(req: Request, tenantId: string, input: FgReceiptInput) {
  const rate = await resolveFgReceiptRate(
    tenantId,
    input.itemId,
    input.workOrderId,
    input.rate,
  )
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'INWARD',
    referenceType: 'SA_RECEIPT',
    quantity: input.quantity,
    movementDate: input.movementDate,
    workOrderId: input.workOrderId,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate,
    createdBy: userId(req),
  })
  return mapStockMovement(movement)
}

export async function postFgDispatchIssue(req: Request, tenantId: string, input: FgDispatchIssueInput) {
  const { isDispatchHardenedPostingEnabled } = await import(
    '../../dispatch/posting/dispatch-policy.js'
  )
  if (isDispatchHardenedPostingEnabled()) {
    const { AuthorizationError } = await import('../../../utils/errors.js')
    throw new AuthorizationError(
      'FG_DISPATCH inventory issues must be posted through Dispatch outbound confirm/post (DispatchPostingService). Direct /inventory/movements/fg-dispatch is blocked while hardened posting is enabled.',
    )
  }
  const movement = await postStockMovement({
    tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    ...tracking(input),
    movementType: 'ISSUE',
    referenceType: 'FG_DISPATCH',
    quantity: input.quantity,
    movementDate: input.movementDate,
    salesOrderId: input.salesOrderId,
    reservationId: input.reservationId,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    createdBy: userId(req),
    allowNegativeStock: canOverrideNegativeStock(req),
    consumeSoReservation: input.consumeSoReservation,
  })
  return mapStockMovement(movement)
}
