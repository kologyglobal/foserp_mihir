import type { Prisma, PurchasePlanningStatus, PurchaseRequisition, PurchaseRequisitionLine } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { isValidSubmittableLine } from '../requisitions/purchase-requisition.workflow.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { computeEstimatedAmount, computeNetPurchaseQuantity } from './purchase-planning.workflow.js'

function initialPlanningStatus(preferredVendorId: string | null): PurchasePlanningStatus {
  return preferredVendorId ? 'VENDOR_SELECTED' : 'PENDING_PLANNING'
}

/**
 * Idempotent planning sync after final PR approval when `rfqRequired = false`.
 * Skips entirely when RFQ is required. Creates one PPS row per valid PR line
 * keyed by `(tenantId, purchaseRequisitionLineId)`.
 */
export async function syncPurchasePlanningRowsFromApprovedPr(
  purchaseRequisitionId: string,
  tenantId: string,
  actorId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ created: number; skipped: number }> {
  const run = async (db: Prisma.TransactionClient) => {
    const pr = await db.purchaseRequisition.findFirst({
      where: { id: purchaseRequisitionId, ...tenantActiveFilter(tenantId) },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })

    if (!pr) return { created: 0, skipped: 0 }
    if (pr.rfqRequired) return { created: 0, skipped: 0 }
    if (pr.status !== 'APPROVED' && pr.status !== 'PARTIALLY_CONVERTED' && pr.status !== 'CONVERTED_TO_PO') {
      return { created: 0, skipped: 0 }
    }

    let created = 0
    let skipped = 0

    for (const line of pr.lines) {
      if (!isValidSubmittableLine(line)) {
        skipped += 1
        continue
      }

      const existing = await db.purchasePlanningRow.findFirst({
        where: {
          tenantId,
          purchaseRequisitionLineId: line.id,
          deletedAt: null,
        },
      })
      if (existing) {
        skipped += 1
        continue
      }

      await createPlanningRowFromLine(db, pr, line, actorId)
      created += 1
    }

    return { created, skipped }
  }

  if (tx) return run(tx)
  return prisma.$transaction((inner) => run(inner))
}

async function createPlanningRowFromLine(
  db: Prisma.TransactionClient,
  pr: PurchaseRequisition,
  line: PurchaseRequisitionLine,
  actorId: string,
): Promise<void> {
  const requiredQuantity = Number(line.requiredQuantity)
  const currentStockQuantity = 0
  const openPurchaseOrderQuantity = 0
  const netPurchaseQuantity = computeNetPurchaseQuantity(
    requiredQuantity,
    currentStockQuantity,
    openPurchaseOrderQuantity,
  )
  const expectedRate = Number(line.estimatedRate)
  const estimatedAmount = computeEstimatedAmount(netPurchaseQuantity, expectedRate)
  const planningNumber = await nextCode(tenantIdOf(pr), 'PURCHASE_PLANNING', db)

  const created = await db.purchasePlanningRow.create({
    data: {
      tenantId: pr.tenantId,
      planningNumber,
      planningDate: new Date(),
      purchaseRequisitionId: pr.id,
      purchaseRequisitionLineId: line.id,
      purchaseRequisitionNumberSnapshot: pr.requisitionNumber,
      departmentId: pr.departmentId,
      requestedById: pr.requestedById,
      itemId: line.itemId,
      itemCodeSnapshot: line.itemCodeSnapshot,
      itemNameSnapshot: line.itemNameSnapshot,
      itemDescriptionSnapshot: line.description,
      requiredQuantity,
      uomId: line.uomId,
      currentStockQuantity,
      openPurchaseOrderQuantity,
      netPurchaseQuantity,
      preferredVendorId: line.preferredVendorId,
      selectedVendorId: line.preferredVendorId,
      lastPurchaseVendorId: line.preferredVendorId,
      lastPurchaseRate: expectedRate > 0 ? expectedRate : null,
      expectedRate,
      estimatedAmount,
      requiredDate: line.requiredDate ?? pr.requiredDate,
      purchaseType: 'DIRECT_PURCHASE',
      priority: pr.priority,
      status: initialPlanningStatus(line.preferredVendorId),
      remarks: line.remarks,
      createdById: actorId,
      updatedById: actorId,
    },
  })

  await writePurchaseAudit({
    tenantId: pr.tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PLANNING,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.PPS_ROW_GENERATED,
    newValue: {
      planningNumber: created.planningNumber,
      purchaseRequisitionId: pr.id,
      purchaseRequisitionLineId: line.id,
    },
  })
}

function tenantIdOf(pr: PurchaseRequisition): string {
  return pr.tenantId
}
