import { prisma } from '../../../config/database.js'
import { toDecimal } from '../shared/quantity.service.js'
import type { CorrectionDependency, CorrectionHandlerContext } from './correction.types.js'

/**
 * Detects common downstream blockers. Prefer explicit ordered plans over cascade.
 */
export async function collectDependencies(
  ctx: CorrectionHandlerContext,
): Promise<CorrectionDependency[]> {
  const deps: CorrectionDependency[] = []
  const orderId = ctx.productionOrderId

  if (orderId) {
    const openQc = await prisma.manufacturingQualityInspection
      .count({
        where: { tenantId: ctx.tenantId, productionOrderId: orderId, status: 'PENDING' },
      })
      .catch(() => 0)
    if (openQc > 0) {
      deps.push({
        code: 'OPEN_QC',
        severity: 'blocker',
        message: 'Open quality inspection(s) exist on this work order — resolve or reverse QC first',
      })
    }

    const openNcr = await prisma.qualityNcr
      .count({
        where: {
          tenantId: ctx.tenantId,
          productionOrderId: orderId,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
      })
      .catch(() => 0)
    if (openNcr > 0) {
      deps.push({
        code: 'OPEN_NCR',
        severity: 'warning',
        message: 'Open NCR(s) exist on this work order',
      })
    }
  }

  if (ctx.transactionType === 'PRODUCTION_PROGRESS') {
    const ledger = await prisma.productionStageLedger.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (ledger) {
      const laterWip = await prisma.productionWipMovement.count({
        where: {
          tenantId: ctx.tenantId,
          productionOrderId: ledger.productionOrderId,
          status: 'POSTED',
          deletedAt: null,
          createdAt: { gt: ledger.createdAt },
        },
      })
      if (laterWip > 0) {
        deps.push({
          code: 'LATER_WIP',
          severity: 'blocker',
          message:
            'WIP was moved after this progress entry. Reverse the WIP movement before correcting progress.',
          entityType: 'WIP_MOVEMENT',
        })
      }
    }
  }

  if (ctx.transactionType === 'MATERIAL_ISSUE') {
    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (movement?.workOrderId) {
      const transfers = await prisma.productionWipMovement.count({
        where: {
          tenantId: ctx.tenantId,
          materialLineId: { not: null },
          productionOrderId: movement.workOrderId,
          status: 'POSTED',
          deletedAt: null,
          createdAt: { gt: movement.createdAt },
        },
      })
      if (transfers > 0) {
        deps.push({
          code: 'MATERIAL_TRANSFERRED',
          severity: 'blocker',
          message: 'Issued material was later transferred. Reverse the material/WIP transfer first.',
        })
      }
    }
  }

  if (ctx.transactionType === 'FG_RECEIPT') {
    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (movement) {
      const balance = await prisma.inventoryStockBalance.findFirst({
        where: {
          tenantId: ctx.tenantId,
          itemId: movement.itemId,
          warehouseId: movement.warehouseId,
        },
      })
      const qty = toDecimal(movement.quantity).abs()
      if (balance && toDecimal(balance.onHandQty).lessThan(qty)) {
        deps.push({
          code: 'FG_CONSUMED',
          severity: 'blocker',
          message:
            'Finished goods stock is no longer fully available (dispatched, transferred, or consumed). Release or reverse those movements first.',
        })
      }
    }
  }

  if (ctx.transactionType === 'WORK_ORDER_SPLIT') {
    deps.push({
      code: 'SPLIT_NOT_IMPLEMENTED',
      severity: 'blocker',
      message:
        'Work Order split is not shipped. Split correction/reversal is unavailable until split exists. Work Order merge remains deferred.',
    })
  }

  if (ctx.transactionType === 'RESERVATION_TRANSFER') {
    deps.push({
      code: 'RESERVATION_TRANSFER_NOT_DOCUMENTED',
      severity: 'blocker',
      message:
        'Standalone reservation-transfer documents are not implemented. Reverse via Inventory reservation cancel/recreate if needed.',
    })
  }

  return deps
}
