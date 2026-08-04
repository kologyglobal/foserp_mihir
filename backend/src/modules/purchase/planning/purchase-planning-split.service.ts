import type { Prisma, PurchasePlanningRow } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PlanningNotEligibleError,
  PlanningRowReadOnlyError,
  PlanningRowNotFoundError,
} from './purchase-planning.errors.js'
import {
  assertPlanningEditable,
  computeEstimatedAmount,
  planningAllocatedQuantity,
  planningRemainingQuantity,
} from './purchase-planning.workflow.js'

export type PlanningSplitInput = {
  vendorId: string
  allocatedQuantity: number
}

export type SplitPlanningRowInput = {
  splits: PlanningSplitInput[]
}

function qty(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

async function assertVendorActive(tenantId: string, vendorId: string): Promise<void> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
    select: { id: true },
  })
  if (!vendor) {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE),
      PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE,
    )
  }
}

function cloneRowData(
  source: PurchasePlanningRow,
  split: PlanningSplitInput,
  planningNumber: string,
  actorId: string,
): Prisma.PurchasePlanningRowUncheckedCreateInput {
  const allocated = qty(split.allocatedQuantity)
  const rate = qty(source.negotiatedRate ?? source.expectedRate)
  return {
    tenantId: source.tenantId,
    planningNumber,
    planningDate: source.planningDate,
    purchaseRequisitionId: source.purchaseRequisitionId,
    purchaseRequisitionLineId: source.purchaseRequisitionLineId,
    purchaseRequisitionNumberSnapshot: source.purchaseRequisitionNumberSnapshot,
    departmentId: source.departmentId,
    requestedById: source.requestedById,
    itemId: source.itemId,
    itemCodeSnapshot: source.itemCodeSnapshot,
    itemNameSnapshot: source.itemNameSnapshot,
    itemDescriptionSnapshot: source.itemDescriptionSnapshot,
    requiredQuantity: source.requiredQuantity,
    uomId: source.uomId,
    currentStockQuantity: source.currentStockQuantity,
    openPurchaseOrderQuantity: source.openPurchaseOrderQuantity,
    netPurchaseQuantity: source.netPurchaseQuantity,
    allocatedQuantity: allocated,
    orderedQuantity: 0,
    preferredVendorId: split.vendorId,
    selectedVendorId: split.vendorId,
    lastPurchaseVendorId: split.vendorId,
    lastPurchaseRate: rate > 0 ? rate : source.lastPurchaseRate,
    expectedRate: source.expectedRate,
    negotiatedRate: source.negotiatedRate,
    estimatedAmount: computeEstimatedAmount(allocated, rate),
    requiredDate: source.requiredDate,
    purchaseType: source.purchaseType,
    priority: source.priority,
    buyerId: source.buyerId,
    status: 'VENDOR_SELECTED',
    actionMessage: false,
    remarks: source.remarks,
    createdById: actorId,
    updatedById: actorId,
  }
}

/**
 * Split one planning row into vendor-specific allocations (same PR line).
 * Allowed only before any PO qty is ordered on the source row.
 */
export async function splitPlanningRow(
  tenantId: string,
  actorId: string,
  rowId: string,
  input: SplitPlanningRowInput,
) {
  if (!input.splits?.length) {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID),
      PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID,
    )
  }

  const row = await prisma.purchasePlanningRow.findFirst({
    where: { id: rowId, ...tenantActiveFilter(tenantId) },
  })
  if (!row) throw new PlanningRowNotFoundError()

  assertPlanningEditable(row)
  if (qty(row.orderedQuantity) > 0) {
    throw new PlanningRowReadOnlyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_SPLIT_NOT_ALLOWED),
      PURCHASE_ERROR_CODE.PPS_SPLIT_NOT_ALLOWED,
    )
  }

  const allocated = planningAllocatedQuantity(row)
  if (!(allocated > 0)) {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID),
      PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID,
    )
  }

  const splitTotal = input.splits.reduce((sum, s) => sum + qty(s.allocatedQuantity), 0)
  if (Math.abs(splitTotal - allocated) > 1e-6) {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_SPLIT_SUM_EXCEEDS),
      PURCHASE_ERROR_CODE.PPS_SPLIT_SUM_EXCEEDS,
    )
  }

  const vendorIds = new Set<string>()
  for (const split of input.splits) {
    const vendorId = split.vendorId?.trim()
    if (!vendorId || !(qty(split.allocatedQuantity) > 0)) {
      throw new PlanningNotEligibleError(
        purchaseMessage(PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID),
        PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID,
      )
    }
    if (vendorIds.has(vendorId)) {
      throw new PlanningNotEligibleError(
        purchaseMessage(PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID),
        PURCHASE_ERROR_CODE.PPS_SPLIT_INVALID,
      )
    }
    vendorIds.add(vendorId)
    await assertVendorActive(tenantId, vendorId)
  }

  const [first, ...rest] = input.splits
  const firstAlloc = qty(first.allocatedQuantity)
  const rate = qty(row.negotiatedRate ?? row.expectedRate)

  const created = await prisma.$transaction(async (tx) => {
    const updated = await tx.purchasePlanningRow.update({
      where: { id: row.id },
      data: {
        allocatedQuantity: firstAlloc,
        selectedVendorId: first.vendorId,
        preferredVendorId: first.vendorId,
        lastPurchaseVendorId: first.vendorId,
        estimatedAmount: computeEstimatedAmount(firstAlloc, rate),
        status: 'VENDOR_SELECTED',
        updatedById: actorId,
      },
    })

    const siblings = []
    for (const split of rest) {
      const planningNumber = await nextCode(tenantId, 'PURCHASE_PLANNING', tx)
      const sibling = await tx.purchasePlanningRow.create({
        data: cloneRowData(row, split, planningNumber, actorId),
      })
      siblings.push(sibling)
    }
    return { updated, siblings }
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PLANNING,
    entityId: row.id,
    action: PURCHASE_AUDIT_ACTION.PPS_UPDATED,
    newValue: {
      splitCount: input.splits.length,
      siblingIds: created.siblings.map((s) => s.id),
    },
  })

  return [created.updated, ...created.siblings]
}

/** Remaining alloc qty helper for tests and services. */
export function planningRemainingForRow(
  row: Pick<PurchasePlanningRow, 'allocatedQuantity' | 'orderedQuantity' | 'netPurchaseQuantity'>,
) {
  return planningRemainingQuantity(row)
}
